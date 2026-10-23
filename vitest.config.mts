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
          name: "rls",
          environment: "node",
          include: ["__tests__/rls/**/*.test.ts"],
          globalSetup: ["__tests__/rls/global-setup.ts"],
          // The files share one database and restore their own writes, so they never run side by side.
          fileParallelism: false,
        },
      },
    ],
  },
});
