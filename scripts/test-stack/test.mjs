// Entry point of `npm test`. It brings the test stack to a known state first (start if down, health and identity
// check, reset when needed), then runs Vitest, which reads the same stack through readTestStack. `--reset`
// forces a reset; every other argument goes to Vitest.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { ensureTestStack } from "./ensure.mjs";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const vitestArgs = args.filter((arg) => arg !== "--reset");

try {
  await ensureTestStack({ reset });
  // The package does not export its bin file, so it is located through package.json.
  const vitest = join(dirname(createRequire(import.meta.url).resolve("vitest/package.json")), "vitest.mjs");
  const child = spawn(process.execPath, [vitest, "run", ...vitestArgs], { stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  process.exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
} catch (error) {
  console.error(`test: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
