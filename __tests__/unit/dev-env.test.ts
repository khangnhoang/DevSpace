import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { envReads } from "../helpers/app-env-reads";
import {
  AI_KEY_VARIABLE,
  DEV_API_PORT,
  DEV_ORIGIN,
  DEV_PORT,
  buildDevApiEnv,
  buildDevEnv,
  buildDevProcessEnv,
} from "../helpers/dev-env";

const stack = {
  apiUrl: "http://127.0.0.1:54321",
  dbUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  anonKey: "local-anon-key",
  serviceRoleKey: "local-service-key",
};

// What a shell that still holds the hosted project, real mail and an AI key would pass to `npm run dev`.
const inherited = {
  PATH: "/usr/bin",
  NEXT_PUBLIC_SUPABASE_URL: "https://hosted-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "hosted-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "hosted-service-key",
  NEXT_PUBLIC_BASE_URL: "https://devspace-lms.vercel.app",
  VERCEL_URL: "devspace-lms.vercel.app",
  GMAIL_USER: "owner@gmail.com",
  GMAIL_PASS: "abcd efgh ijkl mnop",
  GEMINI_API_KEY: "AIzaSyReal-looking-key",
};

describe("buildDevEnv", () => {
  const env = buildDevEnv(stack);

  it("sets every environment variable that app, lib and proxy.ts read, except the AI key, to a non-empty value", () => {
    const { names, unnamed } = envReads();
    expect(
      names.size,
      "the scan should find the variables the app reads",
    ).toBeGreaterThan(0);
    expect(
      unnamed,
      "use process.env.NAME so the dev environment map can be checked",
    ).toEqual([]);
    for (const name of names) {
      if (name === AI_KEY_VARIABLE) continue;
      expect(
        env[name],
        `${name} is read by the app but missing or empty in the dev environment map`,
      ).toBeTruthy();
    }
    expect(
      names.has(AI_KEY_VARIABLE),
      "the AI key exception names a variable the app reads",
    ).toBe(true);
  });

  it("points Next at the API that `npm run dev` starts, on the loopback address", () => {
    expect(env.API_INTERNAL_URL).toBe(`http://127.0.0.1:${DEV_API_PORT}`);
    expect(env.API_PROOF_ENABLED, "the proof page stays off in dev").toBe("0");
  });

  it("holds no empty value and no AI key", () => {
    for (const [name, value] of Object.entries(env))
      expect(value, name).not.toBe("");
    expect(env).not.toHaveProperty(AI_KEY_VARIABLE);
  });

  it("uses the same origin as the local Auth site_url", () => {
    const config = readFileSync(
      fileURLToPath(new URL("../../supabase/config.toml", import.meta.url)),
      "utf8",
    );
    expect(config.match(/^site_url\s*=\s*"([^"]*)"/m)?.[1]).toBe(DEV_ORIGIN);
    expect(DEV_PORT).toBe(3000);
  });
});

describe("buildDevProcessEnv", () => {
  const env = buildDevProcessEnv(inherited, stack);

  it("takes the Supabase URL and keys from the stack, not from the inherited values", () => {
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(stack.apiUrl);
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(stack.anonKey);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe(stack.serviceRoleKey);
  });

  it("replaces the inherited Gmail values with the placeholders", () => {
    expect(env.GMAIL_USER).toBe("dev-placeholder@devspace.test");
    expect(env.GMAIL_PASS).toBe("dev-placeholder-not-a-password");
    expect(JSON.stringify(env)).not.toContain("owner@gmail.com");
  });

  it("removes an inherited AI key so Next takes it only from the environment file", () => {
    expect(env).not.toHaveProperty(AI_KEY_VARIABLE);
  });

  it("points the base URL variables at exactly the dev origin", () => {
    expect(env.NEXT_PUBLIC_BASE_URL).toBe("http://127.0.0.1:3000");
    expect(env.VERCEL_URL).toBe("127.0.0.1:3000");
  });

  it("has a non-empty value for every variable the app reads except the AI key, and names no hosted host", () => {
    for (const name of envReads().names) {
      if (name === AI_KEY_VARIABLE) continue;
      expect(env[name], name).toBeTruthy();
    }
    for (const [name, value] of Object.entries(env)) {
      if (name in inherited && name !== "PATH")
        expect(value, name).not.toMatch(/supabase\.co|vercel\.app|hosted-/);
    }
  });

  it("keeps unrelated inherited variables", () => {
    expect(env.PATH).toBe("/usr/bin");
  });
});

describe("buildDevApiEnv", () => {
  const env = buildDevApiEnv(
    {
      PATH: "/usr/bin",
      HOST: "0.0.0.0",
      PORT: "8080",
      DATABASE_URL: "postgresql://postgres:hosted@db.hosted.example/postgres",
      SUPABASE_URL: "https://hosted-project.supabase.co",
    },
    stack,
  );

  it("binds the API to loopback on port 4000 whatever the caller's shell holds", () => {
    expect(env.HOST).toBe("127.0.0.1");
    expect(env.PORT).toBe(String(DEV_API_PORT));
    expect(DEV_API_PORT).toBe(4000);
    expect(env.PATH).toBe("/usr/bin");
  });

  it("connects as the API role to the local database and ignores an inherited hosted URL", () => {
    const url = new URL(env.DATABASE_URL!);
    expect(url.username).toBe("devspace_api");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.port).toBe("54322");
    expect(env.SUPABASE_URL).toBe(stack.apiUrl);
    expect(env.SUPABASE_ANON_KEY).toBe(stack.anonKey);
    expect(env.ALLOWED_ORIGINS).toBe(DEV_ORIGIN);
    expect(JSON.stringify(env)).not.toMatch(/hosted/);
  });
});
