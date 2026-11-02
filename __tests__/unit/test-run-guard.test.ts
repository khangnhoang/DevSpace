// Test plan
// Goal: a suite started directly (npx vitest, npx playwright test) is refused before it reads the stack, starts a
// server or writes, because it would run beside a locked npm test without registering as a writer.
// Layer: unit with real subprocesses; no Docker and no database are needed because the refusal comes first.
// Subject: requireActiveRun in the Playwright config and the rls global setup.
// Allowed paths: none here; the positive path is the npm commands.
// Denied paths: no run id, and a run id that does not hold the production lock.
// Known bugs: none.
// Invariants: the environment handed to the child never carries a real run.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function direct(args: string[], extra: Record<string, string> = {}) {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.DEVSPACE_TEST_RUN;
  delete env.DEVSPACE_TEST_RUN_DIR;
  env.NODE_OPTIONS = (env.NODE_OPTIONS ?? "").replace(/--import=\S*writer-preload\.mjs/, "").trim();
  const result = spawnSync(process.execPath, args, { cwd: root, env: { ...env, ...extra } as NodeJS.ProcessEnv, encoding: "utf8", timeout: 120_000 });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const playwright = [join(root, "node_modules/@playwright/test/cli.js"), "test"];
const vitest = [join(root, "node_modules/vitest/vitest.mjs"), "run", "--project", "rls"];

describe("direct invocation of a suite that writes to the test stack", { timeout: 150_000 }, () => {
  it.each([
    ["playwright test", playwright, "npm run test:e2e"],
    ["vitest run --project rls", vitest, "npm test"],
  ])("refuses %s without a run, before any server or test starts", (_name, args, command) => {
    const { status, output } = direct(args);
    expect(status).not.toBe(0);
    expect(output).toContain("No test run is active");
    expect(output).toContain(command);
    expect(output).not.toMatch(/Running \d+ test|Test Files|Creating an optimized|Ready in/);
  });

  it.each([
    ["playwright test", playwright],
    ["vitest run --project rls", vitest],
  ])("refuses %s with a forged run id that holds no lock", (_name, args) => {
    const { status, output } = direct(args, { DEVSPACE_TEST_RUN: "forged-run-id" });
    expect(status).not.toBe(0);
    expect(output).toMatch(/does not hold the test stack lock|not registered/);
    expect(output).not.toMatch(/Running \d+ test|Test Files|Creating an optimized|Ready in/);
  });
});
