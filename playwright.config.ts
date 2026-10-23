import { defineConfig, devices } from "@playwright/test";
import { E2E_ORIGIN, E2E_PORT, buildE2eEnv } from "./__tests__/helpers/e2e-env";
import { readLocalStack } from "./__tests__/helpers/local-stack";

// The API URL and keys come from `npx supabase status` only, never from a file: the local environment file
// points at the hosted project. The same map is set for the build, which inlines the NEXT_PUBLIC_* values,
// and for the server.
const serverEnv = buildE2eEnv(readLocalStack(__dirname));
const { env: runnerEnv } = process;

export default defineConfig({
  testDir: "__tests__/e2e",
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(runnerEnv.CI),
  retries: runnerEnv.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: E2E_ORIGIN,
    trace: "retain-on-failure",
    // Route handlers never see redirect hops, so the browser must be unable to resolve any host but a local one.
    // Chromium applies the rules to the IP literal too, so 127.0.0.1 is excluded as well.
    launchOptions: { args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"] },
  },
  projects: [
    // Signs in each seed user once and saves the sessions the specs load (the local Auth limit is 30 sign-ins
    // per 5 minutes).
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", dependencies: ["setup"] },
  ],
  webServer: {
    // Building here, not in a separate step, means no run can serve a stale `.next` that points at hosted.
    command: `npx next build && npx next start -H 127.0.0.1 -p ${E2E_PORT}`,
    url: E2E_ORIGIN,
    // Never reuse a server: one on this port could be a build made with other environment variables.
    reuseExistingServer: false,
    timeout: 600_000,
    stdout: "pipe",
    stderr: "pipe",
    env: serverEnv,
  },
});
