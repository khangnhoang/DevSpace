import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EnvError, readServerEnv } from "../../backend/src/common/env";
import { POOL_MAX, poolConfig } from "../../backend/src/db/pool";
import {
  API_ROLE,
  API_ROLE_LOCAL_PASSWORD,
  apiDatabaseUrl,
} from "../helpers/api-role";

const valid = {
  DATABASE_URL:
    "postgresql://devspace_api:secret-value@127.0.0.1:55322/postgres",
  SUPABASE_URL: "http://127.0.0.1:55321/",
  SUPABASE_ANON_KEY: "anon-key-value",
  ALLOWED_ORIGINS: "http://127.0.0.1:3100, https://devspace-lms.vercel.app/",
};

describe("readServerEnv (AC13)", () => {
  it("reads the required variables and normalizes the origins", () => {
    const env = readServerEnv({
      ...valid,
      PORT: "4001",
      HOST: "127.0.0.1",
      RAILWAY_GIT_COMMIT_SHA: "abc",
    });
    expect(env.port).toBe(4001);
    expect(env.host).toBe("127.0.0.1");
    expect(env.commit).toBe("abc");
    expect(env.allowedOrigins).toEqual([
      "http://127.0.0.1:3100",
      "https://devspace-lms.vercel.app",
    ]);
    expect(env.supabaseUrl).toBe("http://127.0.0.1:55321");
  });

  it.each([
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "ALLOWED_ORIGINS",
  ])(
    "refuses a missing or blank %s and names it without printing any value",
    (name) => {
      for (const value of [undefined, "", "   "]) {
        const env = { ...valid, [name]: value };
        const error = (() => {
          try {
            readServerEnv(env);
          } catch (caught) {
            return caught;
          }
        })();
        expect(error).toBeInstanceOf(EnvError);
        const message = (error as Error).message;
        expect(message).toContain(name);
        expect(message).not.toContain("secret-value");
        expect(message).not.toContain("anon-key-value");
      }
    },
  );

  it("refuses a PORT that is not a port and an origin that is not an http(s) origin", () => {
    expect(() => readServerEnv({ ...valid, PORT: "0" })).toThrow(EnvError);
    expect(() => readServerEnv({ ...valid, PORT: "abc" })).toThrow(EnvError);
    expect(() =>
      readServerEnv({ ...valid, ALLOWED_ORIGINS: "ftp://example.com" }),
    ).toThrow(EnvError);
    expect(() =>
      readServerEnv({ ...valid, ALLOWED_ORIGINS: "not a url" }),
    ).toThrow(EnvError);
    expect(() => readServerEnv({ ...valid, ALLOWED_ORIGINS: " , " })).toThrow(
      EnvError,
    );
  });
});

describe("poolConfig (AC13)", () => {
  it("holds at most 5 connections", () => {
    expect(POOL_MAX).toBe(5);
    expect(poolConfig(valid.DATABASE_URL).max).toBe(5);
  });

  it("turns sslmode=require into encryption without certificate verification, and leaves other URLs alone", () => {
    const required = poolConfig(
      "postgresql://u:p@pooler.example:5432/postgres?sslmode=require",
    );
    expect(required.ssl).toEqual({ rejectUnauthorized: false });
    expect(required.connectionString).not.toContain("sslmode");
    const local = poolConfig(valid.DATABASE_URL);
    expect(local.ssl).toBeUndefined();
    expect(local.connectionString).toContain("127.0.0.1:55322");
  });
});

describe("the local API role helper", () => {
  it("builds the API URL from the stack URL and agrees with the seed", () => {
    const url = new URL(
      apiDatabaseUrl("postgresql://postgres:postgres@127.0.0.1:55322/postgres"),
    );
    expect(url.username).toBe(API_ROLE);
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.port).toBe("55322");
    const seed = readFileSync(
      fileURLToPath(new URL("../../supabase/seed.sql", import.meta.url)),
      "utf8",
    );
    expect(seed).toContain(
      `alter role ${API_ROLE} login password '${API_ROLE_LOCAL_PASSWORD}';`,
    );
  });
});
