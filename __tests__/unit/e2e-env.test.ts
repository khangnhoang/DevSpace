import { describe, expect, it } from "vitest";
import { envReads } from "../helpers/app-env-reads";
import { E2E_ORIGIN, E2E_PORT, buildE2eEnv } from "../helpers/e2e-env";

const stack = {
  apiUrl: "http://127.0.0.1:54321",
  dbUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  anonKey: "anon-key",
  serviceRoleKey: "service-key",
};

describe("buildE2eEnv", () => {
  const env = buildE2eEnv(stack);

  it("sets every environment variable that app, lib and proxy.ts read to a non-empty value", () => {
    const { names, unnamed } = envReads();
    expect(names.size, "the scan should find the variables the app reads").toBeGreaterThan(0);
    expect(unnamed, "use process.env.NAME so the e2e environment map can be checked").toEqual([]);
    for (const name of names) {
      expect(env[name], `${name} is read by the app but missing or empty in the e2e environment map`).toBeTruthy();
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
      expect(value, name).not.toMatch(/supabase\.co|vercel\.app|lkvxxrxojjlkchzzqidu/);
    }
  });
});
