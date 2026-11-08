import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../../../", import.meta.url));

// Used only by api-timeout-note.test.ts: the probe file with a short test timeout, nothing else from the repository config.
export default defineConfig({
  envDir: false,
  root,
  resolve: { alias: { "@": root } },
  test: {
    name: "api-timeout-probe",
    environment: "node",
    include: ["__tests__/unit/probes/api-timeout.probe.ts"],
    testTimeout: 200,
    reporters: ["default"],
  },
});
