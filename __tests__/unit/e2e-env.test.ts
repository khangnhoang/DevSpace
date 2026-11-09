import { describe, expect, it } from "vitest";
import { envReads } from "../helpers/app-env-reads";
import { readServerEnv } from "../../backend/src/common/env";
import {
  E2E_API_ORIGIN,
  E2E_ORIGIN,
  E2E_PORT,
  buildE2eApiEnv,
  buildE2eEnv,
} from "../helpers/e2e-env";

const stack = {
  apiUrl: "http://127.0.0.1:54321",
  dbUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  anonKey: "anon-key",
  serviceRoleKey: "service-key",
};

describe("buildE2eEnv", () => {
  const env = buildE2eEnv(stack);

  it("sets every environment variable that app, lib and proxy.ts read to a non-empty value", () => {
    // next.config.ts is scanned too: it reads the variable that adds the fixture pages to the e2e build (TM-U3 AC20).
    const { names, unnamed } = envReads(["next.config.ts"]);
    expect(
      names.size,
      "the scan should find the variables the app reads",
    ).toBeGreaterThan(0);
    expect(
      names.has("E2E_NEXT_FIXTURES"),
      "the scan reaches next.config.ts",
    ).toBe(true);
    expect(
      unnamed,
      "use process.env.NAME so the e2e environment map can be checked",
    ).toEqual([]);
    for (const name of names) {
      expect(
        env[name],
        `${name} is read by the app but missing or empty in the e2e environment map`,
      ).toBeTruthy();
    }
  });

  it("takes the Supabase URL and keys from the local stack", () => {
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(stack.apiUrl);
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(stack.anonKey);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe(stack.serviceRoleKey);
  });

  it("points the base URL variables at the e2e server, not at port 3000", () => {
    expect(E2E_PORT).not.toBe(3000);
    expect(env.NEXT_PUBLIC_BASE_URL).toBe(E2E_ORIGIN);
    expect(env.VERCEL_URL).toBe(`127.0.0.1:${E2E_PORT}`);
  });

  it("holds no value that names the hosted project or the production site", () => {
    for (const [name, value] of Object.entries(env)) {
      expect(value, name).not.toMatch(
        /supabase\.co|vercel\.app|lkvxxrxojjlkchzzqidu/,
      );
    }
  });

  it("points Next at the e2e API on its own port, and switches the fixture pages on", () => {
    expect(E2E_API_ORIGIN).not.toBe(E2E_ORIGIN);
    expect(env.API_INTERNAL_URL).toBe(E2E_API_ORIGIN);
    expect(env.E2E_NEXT_FIXTURES).toBe("1");
  });
});

describe("buildE2eApiEnv", () => {
  const env = buildE2eApiEnv(stack, "/tmp/api.jsonl");

  it("is a complete API environment: the API reads it without a missing or malformed value", () => {
    const read = readServerEnv(env);
    expect(read.allowedOrigins).toEqual([E2E_ORIGIN]);
    expect(read.port).toBe(Number(new URL(E2E_API_ORIGIN).port));
    expect(read.host).toBe("127.0.0.1");
  });

  it("connects as the API role to the test stack's database and holds no hosted value", () => {
    expect(new URL(env.DATABASE_URL).username).toBe("devspace_api");
    for (const [name, value] of Object.entries(env)) {
      expect(value, name).not.toMatch(
        /supabase\.co|vercel\.app|lkvxxrxojjlkchzzqidu/,
      );
    }
  });
});
