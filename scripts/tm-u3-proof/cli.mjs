// Usage:
//   node scripts/tm-u3-proof/cli.mjs verify --api <API base URL> --app <Next base URL>
//     No cookie. Exits non-zero unless every temporary surface answers 404 on the API and on Next, so both are named
//     (PR 2 removes them; until then the flag must be off everywhere but a proof run).
//   PROOF_COOKIE=<cookie header of the proof owner> node scripts/tm-u3-proof/cli.mjs run --api <base URL> [--origin <app origin>] [--skip-slow]
//     Exercises the surfaces with that session and prints one line per check, with sizes, statuses and timings only.
//     The cookie is read from the environment and never printed or written.
//   PROOF_COOKIE=<cookie header> node scripts/tm-u3-proof/cli.mjs measure --api <base URL> --origin <app origin>
//     M1: 100 sequential and 20 concurrent requests for each of /api/health, /api/health/db, /api/session (warm),
//     /api/proof/session-cold, the proxy.ts check alone (a page of the app) and /api/proof/read, with p50 and p95 end to
//     end and at the API (the temporary Server-Timing header), and the D11 budgets. Timings only.
//   PROOF_TOKEN_A=<access token> PROOF_TOKEN_B=<access token> node scripts/tm-u3-proof/cli.mjs session-probe --api <base URL> --step live|after
//     M2, in two steps with the Owner's sign-out and deletion between them: live (both sessions refused by the proof
//     owner check, 404, plus the Auth round trip with and without the cache), then after (both refused with 401).
//   PROOF_COOKIE=<expired session cookie header> node scripts/tm-u3-proof/cli.mjs refresh-race --origin <app origin>
//     T5: 20 parallel requests with the expired cookie, then a request with the cookies the answers set.
//   Tokens and cookies come from the Owner's terminal environment; they are never printed or written.
import { measure } from "./measure.mjs";
import { runRefreshRace } from "./refresh-race.mjs";
import { runProof } from "./run.mjs";
import { runSessionProbe } from "./session-probe.mjs";
import { verifyAbsent } from "./verify.mjs";

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function finish(outcome) {
  for (const line of outcome.lines) console.log(line);
  process.exit(outcome.failed === 0 ? 0 : 1);
}

const [mode, ...args] = process.argv.slice(2);
const api = option(args, "--api");
const MODES = ["verify", "run", "measure", "session-probe", "refresh-race"];
const needsApi = mode !== "refresh-race";
if (!MODES.includes(mode) || (needsApi && !api)) {
  console.error(
    "usage: cli.mjs verify --api <url> --app <url> | run --api <url> [--origin <origin>] [--skip-slow] | " +
      "measure --api <url> --origin <app origin> | session-probe --api <url> --step live|after | refresh-race --origin <app origin>",
  );
  process.exit(2);
}
// An API that answers 404 says nothing about Next, so verify never runs on one side only.
if (mode === "verify" && !option(args, "--app")) {
  console.error("verify: --app is required, so that Next is checked too");
  process.exit(2);
}

if (mode === "verify") {
  const result = await verifyAbsent({
    apiBase: api,
    appBase: option(args, "--app"),
  });
  for (const failure of result.failures) {
    console.log(
      `STILL REACHABLE ${failure.method} ${failure.url} -> ${failure.status}`,
    );
  }
  console.log(
    `verify: ${result.checked} surfaces checked, ${result.failures.length} not 404`,
  );
  process.exit(result.failures.length === 0 ? 0 : 1);
}

if (mode === "session-probe") {
  const step = option(args, "--step");
  const { PROOF_TOKEN_A: a, PROOF_TOKEN_B: b } = process.env;
  if ((step !== "live" && step !== "after") || !a || !b) {
    console.error(
      "session-probe: --step live|after, and PROOF_TOKEN_A and PROOF_TOKEN_B, are required",
    );
    process.exit(2);
  }
  finish(await runSessionProbe({ apiBase: api, step, tokens: { A: a, B: b } }));
}

const cookie = process.env.PROOF_COOKIE;
if (!cookie) {
  console.error(`${mode}: PROOF_COOKIE is not set`);
  process.exit(2);
}
if (mode === "refresh-race" || mode === "measure") {
  const origin = option(args, "--origin");
  if (!origin) {
    console.error(`${mode}: --origin <app origin> is required`);
    process.exit(2);
  }
  finish(
    mode === "measure"
      ? await measure({ apiBase: api, origin, cookie })
      : await runRefreshRace({ origin, cookie }),
  );
}
finish(
  await runProof({
    apiBase: api,
    cookie,
    origin: option(args, "--origin") ?? new URL(api).origin,
    skipSlow: args.includes("--skip-slow"),
  }),
);
