// Entry point of `npm test`. It takes the test stack lock, brings the stack to a known state (start if down,
// health and identity check, reset when needed), runs Vitest on it and audits the database afterwards
// (run.mjs). `--reset` forces a reset; every other argument goes to Vitest.
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { runOnTestStack, spawnNode } from "./run.mjs";

const args = process.argv.slice(2);
const vitestArgs = args.filter((arg) => arg !== "--reset");
// The package does not export its bin file, so it is located through package.json.
const vitest = join(dirname(createRequire(import.meta.url).resolve("vitest/package.json")), "vitest.mjs");

try {
  process.exitCode = await runOnTestStack({
    command: "npm test",
    reset: args.includes("--reset"),
    runChild: ({ env }) => spawnNode([vitest, "run", ...vitestArgs], env),
  });
} catch (error) {
  console.error(`test: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
