// Entry point of `npm run test:e2e`. It takes the test stack lock and brings the stack to a known state (start if
// down, health and identity check, reset when needed) before the build that playwright.config.ts starts, so a
// missing container or a non-test stack fails here with a clear message. Ports 3100 (Next) and 3101 (the API) must
// be free: the e2e servers never reuse a process. `--reset` forces a reset; the rest goes to Playwright.
import { createRequire } from "node:module";
import { E2E_API_PORT, E2E_PORT } from "../../__tests__/helpers/e2e-env.ts";
import { runOnTestStack, spawnNode } from "../test-stack/run.mjs";
import { assertPortsFree } from "./ports.mjs";

try {
  const args = process.argv.slice(2);
  const playwrightCli = createRequire(import.meta.url).resolve(
    "@playwright/test/cli",
  );
  process.exitCode = await runOnTestStack({
    command: "npm run test:e2e",
    reset: args.includes("--reset"),
    beforeChild: () => assertPortsFree([E2E_PORT, E2E_API_PORT]),
    runChild: ({ env }) =>
      spawnNode(
        [playwrightCli, "test", ...args.filter((arg) => arg !== "--reset")],
        env,
      ),
  });
} catch (error) {
  console.error(
    `e2e: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
