// Entry point of `npm run test:e2e`. It brings the test stack to a known state first (start if down, health and
// identity check, reset when needed), so a missing container or a non-test stack fails here with a clear
// message, before the build that playwright.config.ts starts. `--reset` forces a reset; the rest goes to Playwright.
import { createRequire } from "node:module";
import { ensureTestStack } from "../test-stack/ensure.mjs";
import { startManagedRun, runManagedChild } from "../../__tests__/helpers/managed-run.mjs";

try {
  const args = process.argv.slice(2);
  const { stack } = await ensureTestStack({ reset: args.includes("--reset") });
  const ref = await startManagedRun(stack, "e2e");
  const playwrightCli = createRequire(import.meta.url).resolve("@playwright/test/cli");
  process.exitCode = await runManagedChild(ref, [playwrightCli, "test", ...args.filter((arg) => arg !== "--reset")]);
} catch (error) {
  console.error(`e2e: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
