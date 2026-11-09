// Usage:
//   node scripts/tm-u3-proof/cli.mjs verify --api <API base URL> --app <Next base URL>
//     No cookie. Exits non-zero unless every temporary surface answers 404 on the API and on Next, so both are named
//     (PR 2 removes them; until then the flag must be off everywhere but a proof run).
//   PROOF_COOKIE=<cookie header of the proof owner> node scripts/tm-u3-proof/cli.mjs run --api <app origin> [--origin <app origin>] [--skip-slow]
//     --api is the app origin (Vercel) for the T rows, so they go through the rewrite; a direct Railway URL there
//     exercises a different hop. verify takes both bases; session-probe takes the API base it refuses on.
//     Exercises the surfaces with that session and prints one line per check, with sizes, statuses and timings only.
//     The cookie is read from the environment and never printed or written.
//   PROOF_COOKIE=<cookie header> node scripts/tm-u3-proof/cli.mjs measure --api <app origin> --origin <app origin>
//     --api is the app origin for the end-to-end budget (ADR 0008 D11: through the Vercel origin); a direct Railway URL
//     measures a different hop.
//     M1: 100 sequential and 20 concurrent requests for each of /api/health, /api/health/db, /api/session (warm; the
//     30-second cache entry is refilled unsampled, after waiting for it to expire, once 20 seconds of samples have used it), /api/proof/session-cold, a page with no API
//     call (the proxy.ts check plus delivery of the page) and /api/proof/read (every sample must answer ok), with p50
//     and p95 end to end and at the API (the temporary Server-Timing header), and the D11 budgets. A temporary route
//     without exactly one span on a successful sample fails its batch. Timings only.
//     It also prints one INFO line per mode estimating the added Auth cost (the at-the-API p50 of the cold
//     /api/proof/session-cold minus the warm /api/session; an estimate, not a timed /auth/v1/user round trip).
//   PROOF_TOKEN_A=<access token> PROOF_TOKEN_B=<access token> node scripts/tm-u3-proof/cli.mjs session-probe --api <base URL> --step live|after
//     M2, in two steps with the Owner's sign-out and deletion between them: live (both sessions refused by the proof
//     owner check, 404, which carries no timing), then after (both refused with 401). Statuses only.
//   PROOF_COOKIE=<expired session cookie header> node scripts/tm-u3-proof/cli.mjs refresh-race --origin <app origin>
//     T5: 20 parallel requests with the expired cookie, then a request with the cookies the answers set, applied in the
//     order the answers arrive. Fails unless at least one answer replaced a session cookie (a refresh really happened).
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
