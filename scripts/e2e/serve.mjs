// The `webServer` command of playwright.config.ts: builds the app, then serves it with the network guard and
// the mail record preloaded. The build runs without them because `next build` downloads the Google font. The
// environment arrives from the Playwright config (the same map for both steps). Next is started through
// `node` and not `npx`, so the guard sits in the server process and not in the package runner.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { E2E_PORT } from "../../__tests__/helpers/e2e-env.ts";
import { serverRecordPaths } from "../../__tests__/helpers/e2e-server.ts";

const root = process.cwd();
const next = createRequire(import.meta.url).resolve("next/dist/bin/next");

// The build only reads, so it does not take part in the test run: without the run id and the writer preload its
// many worker processes leave no writer records. The server below inherits both and registers.
const buildEnv = { ...process.env };
delete buildEnv.DEVSPACE_TEST_RUN;
buildEnv.NODE_OPTIONS = (process.env.NODE_OPTIONS ?? "")
  .replace(/--import=\S*writer-preload\.mjs/, "")
  .trim();
const build = spawnSync(process.execPath, [next, "build"], {
  cwd: root,
  env: buildEnv,
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);

// Every run starts with empty records, so a row reads only what happened after it began.
const records = serverRecordPaths(root);
mkdirSync(records.dir, { recursive: true });
writeFileSync(records.guard, "");
writeFileSync(records.mail, "");
writeFileSync(records.auth, "");

// Forward slashes keep the path valid inside NODE_OPTIONS on Windows.
const guard = join(root, "__tests__", "e2e", "server-guard.cjs").replaceAll(
  "\\",
  "/",
);
const server = spawn(
  process.execPath,
  [next, "start", "-H", "127.0.0.1", "-p", String(E2E_PORT)],
  {
    cwd: root,
    env: {
      ...process.env,
      NODE_OPTIONS:
        `${process.env.NODE_OPTIONS ?? ""} --require "${guard}"`.trim(),
      E2E_GUARD_FILE: records.guard,
      E2E_MAIL_FILE: records.mail,
      E2E_AUTH_FILE: records.auth,
    },
    stdio: "inherit",
  },
);
server.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.kill(signal));
