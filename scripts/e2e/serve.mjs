// The `webServer` command of playwright.config.ts: builds the app, then serves it with the network guard and
// the mail record preloaded. It also serves the API beside it (TM-U3 AC16): the e2e build of the API on its own port,
// under the same guard, started first so that Next is never reachable before the API it rewrites to. The build runs without them because `next build` downloads the Google font. The
// environment arrives from the Playwright config (the same map for both steps). Next is started through
// `node` and not `npx`, so the guard sits in the server process and not in the package runner.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { E2E_API_PORT, E2E_PORT } from "../../__tests__/helpers/e2e-env.ts";
import { serverRecordPaths } from "../../__tests__/helpers/e2e-server.ts";

const root = process.cwd();
const next = createRequire(import.meta.url).resolve("next/dist/bin/next");

// The API's environment arrives as JSON from the Playwright config (buildE2eApiEnv), beside the map of the app.
const apiEnv = JSON.parse(process.env.E2E_API_ENV ?? "null");
if (!apiEnv || typeof apiEnv !== "object") {
  throw new Error(
    "e2e: E2E_API_ENV is not set; start the run with `npm run test:e2e`.",
  );
}
// Next must not inherit the API's map (it holds a database URL).
delete process.env.E2E_API_ENV;

// The build only reads, so it does not take part in the test run: without the run id and the writer preload its
// many worker processes leave no writer records. The server below inherits both and registers.
const buildEnv = { ...process.env };
delete buildEnv.DEVSPACE_TEST_RUN;
buildEnv.NODE_OPTIONS = (process.env.NODE_OPTIONS ?? "")
  .replace(/--import=\S*writer-preload\.mjs/, "")
  .trim();
const build = spawnSync(process.execPath, [next, "build"], {
  cwd: root,
  env: buildEnv,
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);
const apiBuild = spawnSync(
  process.execPath,
  [join(root, "scripts", "api", "build.mjs"), "--e2e"],
  { cwd: root, env: buildEnv, stdio: "inherit" },
);
if (apiBuild.status !== 0) process.exit(apiBuild.status ?? 1);

// Every run starts with empty records, so a row reads only what happened after it began.
const records = serverRecordPaths(root);
mkdirSync(records.dir, { recursive: true });
writeFileSync(records.guard, "");
writeFileSync(records.mail, "");
writeFileSync(records.auth, "");
writeFileSync(records.api, "");
writeFileSync(records.next, "");

// Forward slashes keep the path valid inside NODE_OPTIONS on Windows.
const guard = join(root, "__tests__", "e2e", "server-guard.cjs").replaceAll(
  "\\",
  "/",
);
const guarded = `${process.env.NODE_OPTIONS ?? ""} --require "${guard}"`.trim();

// The API sees only its own map, never the app's (which holds the service role key) and never the caller's shell. The
// writer preload in NODE_OPTIONS is kept so the process registers as a writer of the run.
const apiProcessEnv = { ...process.env, ...apiEnv };
for (const name of Object.keys(process.env)) {
  if (name.startsWith("NEXT_") || name === "SUPABASE_SERVICE_ROLE_KEY")
    delete apiProcessEnv[name];
}
const api = spawn(
  process.execPath,
  [join(root, "dist-e2e", "backend", "e2e", "main.js")],
  {
    cwd: root,
    env: {
      ...apiProcessEnv,
      NODE_OPTIONS: guarded,
      E2E_GUARD_FILE: records.guard,
    },
    stdio: "inherit",
  },
);
api.on("exit", (code, signal) => {
  // The API going away fails the run: the rows would otherwise meet a 502 and read it as a product failure.
  console.error(`e2e: the API exited (${code ?? signal}).`);
  process.exit(code || 1);
});

// Next starts only when the API answers its health route.
async function waitForApi() {
  const end = Date.now() + 60_000;
  while (Date.now() < end) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${E2E_API_PORT}/api/health`,
      );
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `e2e: the API did not answer on port ${E2E_API_PORT} within 60 seconds.`,
  );
}
await waitForApi();

const server = spawn(
  process.execPath,
  [next, "start", "-H", "127.0.0.1", "-p", String(E2E_PORT)],
  {
    cwd: root,
    env: {
      ...process.env,
      NODE_OPTIONS: guarded,
      E2E_GUARD_FILE: records.guard,
      E2E_MAIL_FILE: records.mail,
      E2E_AUTH_FILE: records.auth,
    },
    stdio: ["inherit", "pipe", "pipe"],
  },
);
// The server's output is shown as before and also kept (records.next), because Next reports why it refused a server
// action only in its log and the answer carries no reason.
server.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  appendFileSync(records.next, chunk);
});
server.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
  appendFileSync(records.next, chunk);
});
server.on("exit", (code, signal) => {
  api.removeAllListeners("exit");
  api.kill();
  process.exit(code ?? (signal ? 1 : 0));
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    api.removeAllListeners("exit");
    api.kill();
    server.kill(signal);
  });
