// Entry point of `npm run dev`. It reads the local Supabase stack first, so a stopped stack or a non-local API
// host fails here with a clear message, and then starts `next dev` with an environment that holds only local
// values. This launcher never reads `.env*`; Next loads the AI key from the Owner's environment file itself.
// It takes no lock and writes no record: the dev stack belongs to manual QA, and the test commands run on their own stack.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { DEV_HOST, DEV_PORT, buildDevProcessEnv } from "../../__tests__/helpers/dev-env.ts";
import { readLocalStack } from "../../__tests__/helpers/local-stack.ts";

let stack;
try {
  stack = readLocalStack(process.cwd());
} catch (error) {
  console.error(`dev: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [next, "dev", "-H", DEV_HOST, "-p", String(DEV_PORT)], { env: buildDevProcessEnv(process.env, stack), stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.once("error", (error) => { console.error(`dev: ${error.message}`); process.exitCode = 1; });
child.once("exit", (code) => { process.exitCode = code ?? 1; });
