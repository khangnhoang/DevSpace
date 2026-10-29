// Entry point of `npm run dev`. It reads the local Supabase stack first, so a stopped stack or a non-local API
// host fails here with a clear message, and then starts `next dev` with an environment that holds only local
// values. This launcher never reads `.env*`; Next loads the AI key from the Owner's environment file itself.
import { createRequire } from "node:module";
import { DEV_HOST, DEV_PORT, buildDevProcessEnv } from "../../__tests__/helpers/dev-env.ts";
import { readLocalStack } from "../../__tests__/helpers/local-stack.ts";
import { startManagedRun, runManagedChild } from "../../__tests__/helpers/managed-run.mjs";

let stack;
try {
  stack = readLocalStack(process.cwd());
} catch (error) {
  console.error(`dev: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
try {
  const ref = await startManagedRun(stack, "dev");
  process.exitCode = await runManagedChild(ref, [next, "dev", "-H", DEV_HOST, "-p", String(DEV_PORT)], buildDevProcessEnv(process.env, stack));
} catch (error) {
  console.error(`dev: ${error.message}`);
  process.exitCode = 1;
}
