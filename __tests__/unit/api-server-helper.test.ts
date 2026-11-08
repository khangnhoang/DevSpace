// Test plan
// Goal: lib/api.server.ts is the one caller of the API's private address and sends what the API's guards need: the
//   caller's cookie and the app's own Origin (AC11).
// Layer: unit. `next/headers` and `fetch` are replaced; the helper's own logic runs.
// Subject: AC10, AC11 of the TM-U3 plan; ADR 0008 D5.
// Invariants: only a path under /api/ is accepted; nothing but the API's address is called; a missing address or
//   origin is an error, not a silent default; the private address appears in no file but the helper and proxy.ts.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookieStore = vi.hoisted(() => ({
  items: [] as { name: string; value: string }[],
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => cookieStore.items }),
}));

import { ApiConfigError, apiFetch } from "@/lib/api.server";

const root = fileURLToPath(new URL("../..", import.meta.url));
const fetchMock = vi.fn();

beforeEach(() => {
  cookieStore.items = [
    { name: "sb-127-auth-token.0", value: "base64-aaa" },
    { name: "sb-127-auth-token.1", value: "bbb" },
  ];
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_INTERNAL_URL", "http://api.internal:4000");
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://app.example/some/path");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("calls the API's own address with the caller's cookie and the app's origin", async () => {
    await apiFetch("/api/session");
    const [target, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(target)).toBe("http://api.internal:4000/api/session");
    expect(init.headers).toEqual({
      Cookie: "sb-127-auth-token.0=base64-aaa; sb-127-auth-token.1=bbb",
      Origin: "https://app.example",
    });
    expect(init.method).toBe("GET");
  });

  it("sets Origin on a POST too, and passes the method and body through", async () => {
    await apiFetch("/api/e2e/mutate", { method: "POST", body: "x" });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Origin).toBe(
      "https://app.example",
    );
    expect(init.body).toBe("x");
  });

  it("sends no Cookie header when the caller has no cookie, and never caches or follows a redirect", async () => {
    cookieStore.items = [];
    await apiFetch("/api/session");
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.headers).toEqual({ Origin: "https://app.example" });
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("manual");
  });

  it.each([
    "http://evil.example/api/session",
    "//evil.example/api/session",
    "/other/session",
    "/api/../admin",
    "api/session",
    "/api",
  ])(
    "refuses %s: a path that is not under /api/ never reaches fetch",
    async (path) => {
      await expect(apiFetch(path)).rejects.toBeInstanceOf(ApiConfigError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("fails loudly when the API's address or the app's origin is not configured", async () => {
    vi.stubEnv("API_INTERNAL_URL", "");
    await expect(apiFetch("/api/session")).rejects.toThrow("API_INTERNAL_URL");
    vi.stubEnv("API_INTERNAL_URL", "http://api.internal:4000");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    await expect(apiFetch("/api/session")).rejects.toThrow(
      "NEXT_PUBLIC_BASE_URL",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("who reads the API's private address (AC11)", () => {
  function files(dir: string): string[] {
    return readdirSync(join(root, dir)).flatMap((name) => {
      const relative = join(dir, name);
      if (statSync(join(root, relative)).isDirectory()) return files(relative);
      return /\.(ts|tsx|mjs|js)$/.test(name)
        ? [relative.replaceAll("\\", "/")]
        : [];
    });
  }

  it("is read by lib/api.server.ts (the calls) and proxy.ts (the rewrite) and by nothing else in app, lib or proxy.ts", () => {
    const readers = [...files("app"), ...files("lib"), "proxy.ts"].filter(
      (file) =>
        readFileSync(join(root, file), "utf8").includes("API_INTERNAL_URL"),
    );
    expect(readers.sort()).toEqual(["lib/api.server.ts", "proxy.ts"]);
  });

  it("is never read from a client file", () => {
    const clients = [...files("app"), ...files("lib")].filter((file) =>
      /^\s*["']use client["']/m.test(readFileSync(join(root, file), "utf8")),
    );
    for (const file of clients) {
      expect(readFileSync(join(root, file), "utf8"), file).not.toContain(
        "API_INTERNAL_URL",
      );
    }
  });

  it("is called through the helper by every file that fetches the API from Next", () => {
    // A file in app or lib that names `/api/` in a call goes through apiFetch, not through fetch.
    const callers = [...files("app"), ...files("lib")].filter((file) => {
      const text = readFileSync(join(root, file), "utf8");
      return /fetch\(\s*[`"']\/api\//.test(text);
    });
    expect(callers).toEqual([]);
  });
});
