import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../../../", import.meta.url));

// Used only by hook-timeout.test.ts: the probe file, a short hook timeout, nothing else from the repository config.
export default defineConfig({
  envDir: false,
  root,
  resolve: { alias: { "@": root } },
  test: {
    name: "hook-timeout-probe",
    environment: "node",
    include: ["__tests__/unit/probes/hook-timeout.probe.ts"],
    hookTimeout: 250,
    reporters: ["default"],
  },
});
