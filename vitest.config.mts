import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

// `envDir: false` turns env-file loading off: a developer's local env file points at the hosted project,
// and the `rls` project must take its URLs and keys from the local Supabase stack only.
export default defineConfig({
  envDir: false,
  resolve: { alias: { "@": root } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["__tests__/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          // Client components render in jsdom; the files stay apart from the node-only `unit` files (a .tsx suffix).
          environment: "jsdom",
          include: ["__tests__/unit/components/**/*.test.tsx"],
          setupFiles: ["__tests__/unit/components/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "api",
          environment: "node",
          include: ["__tests__/api/**/*.test.ts"],
          globalSetup: ["__tests__/api/global-setup.ts"],
          // The files start API processes on the shared test stack, so they never run side by side.
          fileParallelism: false,
          // A test may start the API (about 1 s on Windows, with the writer record) and wait on a 10 s probe window.
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: "rls",
          environment: "node",
          include: ["__tests__/rls/**/*.test.ts"],
          globalSetup: ["__tests__/rls/global-setup.ts"],
          // The files share one database and restore their own writes, so they never run side by side.
          fileParallelism: false,
          // Windows full-suite runs (unit + rls in one process) put e2e-preflight.test.ts at 3.0-3.3 s against the
          // 5 s default and once past it. The slowest RLS test without its own timeout is that file, so 15 s is
          // about 4.5x its measured worst; a real hang still fails, and a timed-out scope still blocks later ones.
          testTimeout: 15_000,
        },
      },
    ],
  },
});
