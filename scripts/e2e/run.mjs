// Entry point of `npm run test:e2e`. It takes the test stack lock and brings the stack to a known state (start if
// down, health and identity check, reset when needed) before the build that playwright.config.ts starts, so a
// missing container or a non-test stack fails here with a clear message. Port 3100 must be free: the e2e server
// never reuses a process. `--reset` forces a reset; the rest goes to Playwright.
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { runOnTestStack, spawnNode } from "../test-stack/run.mjs";

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () => reject(new Error(`Port ${port} is in use, and the e2e server never reuses a process. Stop whatever listens on it, then run the command again.`)));
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}

try {
  const args = process.argv.slice(2);
  const playwrightCli = createRequire(import.meta.url).resolve("@playwright/test/cli");
  process.exitCode = await runOnTestStack({
    command: "npm run test:e2e",
    reset: args.includes("--reset"),
    beforeChild: () => assertPortFree(3100),
    runChild: ({ env }) => spawnNode([playwrightCli, "test", ...args.filter((arg) => arg !== "--reset")], env),
  });
} catch (error) {
  console.error(`e2e: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
