// Usage:
//   node scripts/tm-u3-proof/cli.mjs verify --api <API base URL> [--app <Next base URL>]
//     No cookie. Exits non-zero unless every temporary surface answers 404 (PR 2 removes them; until then the flag
//     must be off everywhere but a proof run).
//   PROOF_COOKIE=<cookie header of the proof owner> node scripts/tm-u3-proof/cli.mjs run --api <base URL> [--origin <app origin>] [--skip-slow]
//     Exercises the surfaces with that session and prints one line per check, with sizes, statuses and timings only.
//     The cookie is read from the environment and never printed or written.
import { runProof } from "./run.mjs";
import { verifyAbsent } from "./verify.mjs";

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const [mode, ...args] = process.argv.slice(2);
const api = option(args, "--api");
if (!api || (mode !== "verify" && mode !== "run")) {
  console.error(
    "usage: cli.mjs verify|run --api <url> [--app <url>] [--origin <origin>] [--skip-slow]",
  );
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

const cookie = process.env.PROOF_COOKIE;
if (!cookie) {
  console.error("run: PROOF_COOKIE is not set");
  process.exit(2);
}
const outcome = await runProof({
  apiBase: api,
  cookie,
  origin: option(args, "--origin") ?? new URL(api).origin,
  skipSlow: args.includes("--skip-slow"),
});
for (const line of outcome.lines) console.log(line);
process.exit(outcome.failed === 0 ? 0 : 1);
