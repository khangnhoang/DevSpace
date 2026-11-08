// Entry point of `npm run dev`. It reads the local Supabase stack first, so a stopped stack or a non-local API
// host fails here with a clear message before either server starts, then builds the API and runs `next dev` and
// the API together with an environment that holds only local values (supervise.mjs ends both when one exits).
// This launcher never reads `.env*`; Next loads the AI key from the Owner's environment file itself.
// It takes no lock and writes no record: the dev stack belongs to manual QA, and the test commands run on their own stack.
// The API is built once at start; restart `npm run dev` to pick up a backend change.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import {
  DEV_HOST,
  DEV_PORT,
  buildDevApiEnv,
  buildDevProcessEnv,
} from "../../__tests__/helpers/dev-env.ts";
import { readLocalStack } from "../../__tests__/helpers/local-stack.ts";
import { superviseAll } from "./supervise.mjs";

const root = process.cwd();

let stack;
try {
  stack = readLocalStack(root);
} catch (error) {
  console.error(
    `dev: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

const build = spawnSync(
  process.execPath,
  [join(root, "scripts", "api", "build.mjs")],
  { cwd: root, stdio: "inherit" },
);
if (build.status !== 0) {
  console.error("dev: the API build failed, so nothing was started.");
  process.exit(build.status ?? 1);
}

const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
process.exitCode = await superviseAll([
  {
    name: "next dev",
    command: process.execPath,
    args: [next, "dev", "-H", DEV_HOST, "-p", String(DEV_PORT)],
    env: buildDevProcessEnv(process.env, stack),
  },
  {
    name: "api",
    command: process.execPath,
    args: [join(root, "dist", "backend", "src", "main.js")],
    env: buildDevApiEnv(process.env),
  },
]);
