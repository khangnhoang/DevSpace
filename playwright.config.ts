import { defineConfig, devices } from "@playwright/test";
import {
  E2E_ORIGIN,
  buildE2eApiEnv,
  buildE2eEnv,
} from "./__tests__/helpers/e2e-env";
import { serverRecordPaths } from "./__tests__/helpers/e2e-server";
import { requireActiveRun } from "./scripts/test-stack/lock.mjs";
import { readTestStack } from "./scripts/test-stack/read.mjs";

// A direct `npx playwright test` would write to the test stack beside a locked run; refuse it before the stack is read
// or a server starts.
requireActiveRun({ command: "npm run test:e2e" });

// The API URL and keys come from the test stack's `supabase status` only, never from a file: the local environment file
// points at the hosted project. The same map is set for the build, which inlines the NEXT_PUBLIC_* values,
// and for the server.
const testStack = readTestStack(__dirname);
const serverEnv = buildE2eEnv(testStack);
// The API of the run (TM-U3): its environment goes to scripts/e2e/serve.mjs as one JSON value, so the app's map stays
// the map of what `app`, `lib` and `proxy.ts` read.
const apiEnv = buildE2eApiEnv(testStack, serverRecordPaths(__dirname).api);
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
    launchOptions: {
      args: [
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1",
      ],
    },
  },
  projects: [
    // Signs in each seed user once and saves the sessions the specs load (the local Auth limit is 30 sign-ins
    // per 5 minutes).
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", dependencies: ["setup"] },
  ],
  webServer: {
    // Building here, not in a separate step, means no run can serve a stale `.next` that points at hosted.
    // serve.mjs builds without the server guard and serves with it.
    command: "node scripts/e2e/serve.mjs",
    url: E2E_ORIGIN,
    // Never reuse a server: one on this port could be a build made with other environment variables.
    reuseExistingServer: false,
    timeout: 600_000,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...serverEnv, E2E_API_ENV: JSON.stringify(apiEnv) },
  },
});
