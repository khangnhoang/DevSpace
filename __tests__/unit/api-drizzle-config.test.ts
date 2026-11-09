// Test plan
// Goal: backend/drizzle.config.ts refuses a database that is not the local stack when drizzle-kit loads it directly,
//   which skips the scripts/api/schema.mjs wrapper (plan G7, AC14).
// Layer: unit; a real `drizzle-kit pull` process loads the config. The URLs are unreachable on purpose: a refusal comes
//   from the config's own check, and an attempt to connect would show as a different error.
// Subject: the load-time check of DRIZZLE_DATABASE_URL.
// Invariants: nothing is pulled and no connection is opened for a hosted-looking or missing URL; the message names the
//   variable and the host, never a password.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

function pull(env: Record<string, string | undefined>) {
  return new Promise<{ code: number | null; output: string }>((resolve) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/drizzle-kit/bin.cjs",
        "pull",
        "--config",
        "backend/drizzle.config.ts",
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          DRIZZLE_OUT: "scratch-never-written",
          DRIZZLE_DATABASE_URL: undefined,
          ...env,
        },
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("close", (code) => resolve({ code, output }));
  });
}

describe("backend/drizzle.config.ts loaded directly", () => {
  it("refuses a hosted-looking host before any connection, naming the variable and the host and not the password", async () => {
    const result = await pull({
      DRIZZLE_DATABASE_URL:
        "postgresql://postgres:FAKE-SECRET-4k@db.hosted-project.invalid:5432/postgres",
    });
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("db.hosted-project.invalid");
    expect(result.output).toContain("not the local Supabase stack");
    expect(result.output).not.toContain("FAKE-SECRET-4k");
    expect(result.output).not.toMatch(/ENOTFOUND|ECONNREFUSED/);
  }, 60_000);

  it("refuses an unset URL", async () => {
    const result = await pull({});
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("DRIZZLE_DATABASE_URL");
    expect(result.output).toContain("not a valid URL");
  }, 60_000);
});
