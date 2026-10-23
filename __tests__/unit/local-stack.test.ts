import { describe, expect, it } from "vitest";
import { assertLocalUrl, parseLocalStack } from "../helpers/local-stack";

const HTTP = ["http:", "https:"];

describe("assertLocalUrl", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321"])("accepts %s", (url) => {
    expect(assertLocalUrl("API URL", url, HTTP)).toBe(url);
  });

  it.each([
    ["the hosted project URL", "https://lkvxxrxojjlkchzzqidu.supabase.co"],
    ["a host that only starts with 127.0.0.1", "http://127.0.0.1.evil.example"],
    ["an empty value", ""],
    ["a loopback name in the user info", "http://127.0.0.1@evil.example"],
  ])("rejects %s", (_label, url) => {
    expect(() => assertLocalUrl("API URL", url, HTTP)).toThrow(/local Supabase stack/);
  });

  it("rejects a protocol outside the allowed list", () => {
    expect(() => assertLocalUrl("API URL", "ftp://127.0.0.1:54321", HTTP)).toThrow(/local Supabase stack/);
  });
});

describe("parseLocalStack", () => {
  const status = {
    API_URL: "http://127.0.0.1:54321",
    DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    ANON_KEY: "anon-key",
    SERVICE_ROLE_KEY: "service-key",
  };

  it("returns the URLs and keys of a local stack", () => {
    expect(parseLocalStack(JSON.stringify(status))).toEqual({
      apiUrl: status.API_URL,
      dbUrl: status.DB_URL,
      anonKey: "anon-key",
      serviceRoleKey: "service-key",
    });
  });

  it("refuses a hosted API URL before returning anything", () => {
    const hosted = { ...status, API_URL: "https://lkvxxrxojjlkchzzqidu.supabase.co" };
    expect(() => parseLocalStack(JSON.stringify(hosted))).toThrow(/local Supabase stack/);
  });

  it("refuses a hosted database URL", () => {
    const hosted = { ...status, DB_URL: "postgresql://postgres:x@db.lkvxxrxojjlkchzzqidu.supabase.co:5432/postgres" };
    expect(() => parseLocalStack(JSON.stringify(hosted))).toThrow(/local Supabase stack/);
  });

  it("refuses output that is not JSON", () => {
    expect(() => parseLocalStack("supabase start is not running")).toThrow(/local Supabase stack/);
  });

  it("refuses a status without keys", () => {
    const keyless = { ...status, ANON_KEY: "" };
    expect(() => parseLocalStack(JSON.stringify(keyless))).toThrow(/local Supabase stack/);
  });
});
