// Builds the API with tsc into a clean output folder: `dist` for the production entry point, or `dist-e2e` with
// `--e2e`, which also compiles backend/e2e (the test-only fixtures, AC20) and so never shares a folder with the
// production output. The folder is removed first so a file deleted from the source cannot linger in the output.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const e2e = process.argv.includes("--e2e");
const outDir = join(root, e2e ? "dist-e2e" : "dist");
const project = join(
  root,
  "backend",
  e2e ? "tsconfig.e2e.json" : "tsconfig.json",
);
const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");

rmSync(outDir, { recursive: true, force: true });
const result = spawnSync(process.execPath, [tsc, "-p", project], {
  cwd: root,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
