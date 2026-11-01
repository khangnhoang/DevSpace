// Starts, checks, resets and stops the `devspace-test` stack for `npm test`, `npm run test:e2e` and
// `npm run test:stack:stop`. Every Supabase CLI call goes through `supabase()`, which always passes the
// generated test workdir (G1) and runs the identity check for its operation first (AC8), so no command here can
// fall through to the dev stack's default workdir or to the hosted-linked config.
import { spawnSync } from "node:child_process";
import { EXCLUDED_SERVICES, TEST_PORTS, TEST_PROJECT_ID, prepareTestWorkdir } from "./config.mjs";
import { checkStart, checkStop, checkWrite, createDocker, describeProblems, requiredProblems, waitForRequired } from "./docker.mjs";
import { readState, writeState } from "./state.mjs";
import { readTestStack } from "./read.mjs";

const dbVolume = `supabase_db_${TEST_PROJECT_ID}`;

// (a) an unclean last run, (b) changed inputs, (c) a start without the data volume, (d) --reset. A fresh start
// applies the migrations and seed itself, so it needs no reset but still records the hash.
export function decideReset({ state, hash, fresh, force }) {
  if (force) return { reset: true, kind: "d", reason: "--reset was passed" };
  if (fresh) return { reset: false, kind: "c", reason: "the stack started without its data volume, so the migrations and seed were applied by the start" };
  if (state?.status === "dirty") return { reset: true, kind: "a", reason: `the last run did not finish cleanly${state.cause ? ` (${state.cause})` : ""}` };
  if (!state?.resetHash) return { reset: true, kind: "b", reason: "no reset is recorded for the test stack" };
  if (state.resetHash !== hash) return { reset: true, kind: "b", reason: "supabase/migrations, supabase/seed.sql or the test config changed since the last reset" };
  return { reset: false, kind: null, reason: "nothing changed since the last clean reset" };
}

async function supabase(operation, { root, docker, workdir, project = TEST_PROJECT_ID, extraExcludes = [] }) {
  let args;
  if (operation === "start") {
    await checkStart(docker, { project, ports: [TEST_PORTS.api, TEST_PORTS.db] });
    args = ["start", "-x", [...EXCLUDED_SERVICES, ...extraExcludes].join(",")];
  } else if (operation === "reset") {
    checkWrite(docker, { project, dbPort: TEST_PORTS.db, apiPort: TEST_PORTS.api });
    args = ["db", "reset"];
  } else if (operation === "stop") {
    checkStop(docker, { project });
    args = ["stop"];
  } else {
    throw new Error(`Unsupported test stack operation: ${operation}`);
  }
  // The CLI writes its progress to stderr and a status JSON with the stack keys to stdout; only progress is shown.
  // A shell is needed to resolve `npx` on Windows; the workdir is quoted for paths with spaces.
  const result = spawnSync(`npx supabase ${args.join(" ")} --workdir "${workdir}"`, { cwd: root, shell: true, stdio: ["ignore", "ignore", "inherit"] });
  return result.status ?? 1;
}

const log = (message) => console.log(`test stack: ${message}`);

export async function ensureTestStack({ root = process.cwd(), reset = false, docker = createDocker(), extraExcludes = [] } = {}) {
  const { workdir, hash } = prepareTestWorkdir(root);
  const context = { root, docker, workdir, extraExcludes };
  const fresh = !docker.volumeExists(dbVolume);

  if (requiredProblems(docker).length) {
    log("starting the test stack (devspace-test)");
    const status = await supabase("start", context);
    const problems = await waitForRequired(docker);
    if (problems.length) throw new Error(describeProblems(problems));
    if (status !== 0) throw new Error(`supabase start exited with code ${status} although the containers are running. The output above has the cause.`);
  } else {
    const problems = await waitForRequired(docker);
    if (problems.length) throw new Error(describeProblems(problems));
  }

  const decision = decideReset({ state: readState(), hash, fresh, force: reset });
  if (decision.reset) {
    log(`resetting the test database because ${decision.reason}`);
    const status = await supabase("reset", context);
    if (status !== 0) throw new Error(`supabase db reset exited with code ${status}. The test stack is not usable; fix the cause above and run the command again.`);
    const problems = await waitForRequired(docker);
    if (problems.length) throw new Error(describeProblems(problems));
  } else {
    log(`no reset: ${decision.reason}`);
  }
  // The hash is recorded after a reset or a fresh start only, so (b) compares with the last time the database
  // was rebuilt from these inputs.
  if (decision.reset || decision.kind === "c") writeState({ status: "clean", resetHash: hash, resetAt: new Date().toISOString() });

  const stack = readTestStack(root);
  log(`using api ${stack.apiUrl}, database ${new URL(stack.dbUrl).host} (project ${stack.project})`);
  return { stack, decision };
}

// Stops only the test project and confirms with Docker that none of its containers remain.
export async function stopTestStack({ root = process.cwd(), docker = createDocker() } = {}) {
  const { workdir } = prepareTestWorkdir(root);
  const status = await supabase("stop", { root, docker, workdir });
  const remaining = docker.containers().filter((container) => container.project === TEST_PROJECT_ID);
  if (status !== 0 || remaining.length) {
    throw new Error(`The test stack did not stop cleanly (supabase stop exit ${status}; remaining: ${remaining.map((container) => container.name).join(", ") || "none"}). Check Docker Desktop and run npm run test:stack:stop again.`);
  }
  log("stopped; no devspace-test container remains");
}
