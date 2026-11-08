import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

export type EnumeratedRoute = { method: string; path: string; public: boolean };
export type RouteEnumeration = {
  // What the Nest controllers declare, with the public marker (backend/src/auth/routes.ts).
  declared: EnumeratedRoute[];
  // What the Express router actually registered after the application was initialized, as "METHOD path".
  registered: string[];
};

// Runs inside a child process on the compiled output, because the API relies on decorator metadata that the test
// runner's transform does not emit. The application is built and initialized but never listens, and the pool it
// creates never connects, so nothing is reached. `dist` is the production build and `dist-e2e` the build with the
// test-only routes (AC20).
const SCRIPT = `
const path = require("node:path");
const { ROUTES_ROOT: root, ROUTES_FOLDER: folder } = process.env;
const out = (name) => require(path.join(root, folder, "backend", name));
(async () => {
  const { readServerEnv } = out("src/common/env.js");
  const { createApp } = out("src/bootstrap.js");
  const { listRoutes } = out("src/auth/routes.js");
  const extra = folder === "dist-e2e" ? [out("e2e/e2e.module.js").E2eModule.register()] : [];
  const env = readServerEnv({
    DATABASE_URL: "postgresql://devspace_api:x@127.0.0.1:1/postgres",
    SUPABASE_URL: "http://127.0.0.1:1",
    SUPABASE_ANON_KEY: "x",
    ALLOWED_ORIGINS: "http://127.0.0.1:3100",
  });
  const app = await createApp(env, extra);
  await app.init();
  const stack = app.getHttpAdapter().getInstance().router.stack;
  const registered = stack
    .filter((layer) => layer.route)
    .flatMap((layer) => Object.keys(layer.route.methods).map((method) => method.toUpperCase() + " " + layer.route.path));
  const declared = listRoutes(app);
  await app.close();
  console.log("ROUTES:" + JSON.stringify({ declared, registered }));
})().catch((error) => { console.error(error); process.exit(1); });
`;

export function enumerateRoutes(folder: "dist" | "dist-e2e"): RouteEnumeration {
  // The script goes in through stdin: a multi-line argument does not survive Windows command-line quoting.
  const result = spawnSync(process.execPath, ["-"], {
    cwd: root,
    input: SCRIPT,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, ROUTES_ROOT: root, ROUTES_FOLDER: folder },
  });
  const line = result.stdout
    .split("\n")
    .find((entry) => entry.startsWith("ROUTES:"));
  if (result.status !== 0 || !line) {
    throw new Error(
      `Enumerating the routes of ${folder} failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`,
    );
  }
  return JSON.parse(line.slice("ROUTES:".length)) as RouteEnumeration;
}
