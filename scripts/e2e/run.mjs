// Entry point of `npm run test:e2e`. It checks the local Supabase stack first, so a stopped stack or a
// non-local API host fails here with a clear message, before the build that playwright.config.ts starts.
import { createRequire } from "node:module";
import { readLocalStack } from "../../__tests__/helpers/local-stack.ts";
import { startManagedRun, runManagedChild } from "../../__tests__/helpers/managed-run.mjs";

try {
  const stack = readLocalStack(process.cwd());
  const ref = await startManagedRun(stack, "e2e");
  const playwrightCli = createRequire(import.meta.url).resolve("@playwright/test/cli");
  process.exitCode = await runManagedChild(ref, [playwrightCli, "test", ...process.argv.slice(2)]);
} catch (error) {
  console.error(`e2e: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
