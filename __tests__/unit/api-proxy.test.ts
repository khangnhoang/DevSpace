// Test plan
// Goal: proxy.ts rewrites /api/* to the API's private address, carrying the cookies that getUser() refreshed, answers 503
//   when the address is not set, and leaves every other route as updateSession returned it (AC10).
// Layer: unit. updateSession is replaced by a stand-in that refreshes a cookie the way lib/supabase.proxy.ts does; the
//   proxy's own logic runs on real NextRequest and NextResponse objects. The real thing through Next is
//   __tests__/e2e/api-topology.spec.ts.
// Subject: AC10 of the TM-U3 plan; ADR 0008 D5.
import { NextRequest, NextResponse } from "next/server";
import { getMiddlewareMatchers } from "next/dist/build/analysis/get-page-static-info";
import { getMiddlewareRouteMatcher } from "next/dist/shared/lib/router/utils/middleware-route-matcher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ calls: 0 }));
vi.mock("@/lib/supabase.proxy", () => ({
  updateSession: async (request: NextRequest) => {
    session.calls += 1;
    // What the real one does when getUser() refreshes: the new cookie goes onto the request and onto the response.
    request.cookies.set("sb-127-auth-token", "refreshed");
    const response = NextResponse.next({ request });
    response.cookies.set("sb-127-auth-token", "refreshed", {
      path: "/",
      httpOnly: false,
    });
    response.headers.set("cache-control", "private, no-store");
    return response;
  },
}));

import { config, proxy } from "@/proxy";

const BASE = "http://api.internal:4000";
const get = (path: string) =>
  new NextRequest(`http://127.0.0.1:3000${path}`, {
    headers: { cookie: "sb-127-auth-token=stale" },
  });

beforeEach(() => {
  session.calls = 0;
  vi.stubEnv("API_INTERNAL_URL", BASE);
});
afterEach(() => vi.unstubAllEnvs());

describe("proxy rewrite", () => {
  it("rewrites /api/* to the API with the path and query unchanged", async () => {
    const response = await proxy(get("/api/proof/read?a=1&b=2"));
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      `${BASE}/api/proof/read?a=1&b=2`,
    );
  });

  it("rewrites /api itself", async () => {
    const response = await proxy(get("/api"));
    expect(response.headers.get("x-middleware-rewrite")).toBe(`${BASE}/api`);
  });

  it("runs getUser() through updateSession on every request it handles, /api/* included", async () => {
    await proxy(get("/api/health"));
    await proxy(get("/course/x"));
    expect(session.calls).toBe(2);
  });

  it("returns the refreshed cookie to the browser on the rewritten response", async () => {
    const response = await proxy(get("/api/session"));
    expect(response.cookies.get("sb-127-auth-token")?.value).toBe("refreshed");
    expect(response.headers.get("set-cookie")).toContain(
      "sb-127-auth-token=refreshed",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("forwards the refreshed cookie, not the stale one, to the API", async () => {
    const response = await proxy(get("/api/session"));
    const overridden =
      response.headers.get("x-middleware-override-headers") ?? "";
    expect(overridden.split(",")).toContain("cookie");
    expect(response.headers.get("x-middleware-request-cookie")).toBe(
      "sb-127-auth-token=refreshed",
    );
  });

  it("leaves a path that only starts with /api as the page it is", async () => {
    for (const path of ["/apix", "/apiary/1", "/course/api/x"]) {
      const response = await proxy(get(path));
      expect(response.headers.get("x-middleware-rewrite"), path).toBeNull();
    }
  });

  it("leaves every other route exactly as updateSession returned it", async () => {
    const response = await proxy(get("/course/javascript-can-ban"));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.cookies.get("sb-127-auth-token")?.value).toBe("refreshed");
  });
});

describe("proxy with no API address", () => {
  beforeEach(() => vi.stubEnv("API_INTERNAL_URL", ""));

  it("answers 503 on /api/* and leaves a body-less response", async () => {
    for (const path of ["/api/health", "/api/proof/echo", "/api"]) {
      const response = await proxy(get(path));
      expect(response.status, path).toBe(503);
      expect(response.headers.get("x-middleware-rewrite"), path).toBeNull();
    }
  });

  it("carries the cookies that getUser() refreshed, and the cache-control header, onto the 503", async () => {
    const response = await proxy(get("/api/session"));
    expect(response.status).toBe(503);
    expect(response.cookies.get("sb-127-auth-token")?.value).toBe("refreshed");
    expect(response.headers.get("set-cookie")).toContain(
      "sb-127-auth-token=refreshed",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("still runs getUser() and leaves every other route unchanged", async () => {
    const response = await proxy(get("/profile"));
    expect(session.calls).toBe(1);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

// The matcher decides which requests reach proxy() at all, and the rows above call proxy() directly, so this is read
// the way Next builds it (getMiddlewareMatchers) and applied to paths.
describe("proxy matcher", () => {
  const matches = getMiddlewareRouteMatcher(
    getMiddlewareMatchers(config.matcher, {}),
  );

  it.each([
    "/api",
    "/api/health",
    "/api/proof/echo",
    "/api/file.png",
    "/api/a/b.svg",
    "/api/image.webp",
  ])("passes %s to the proxy, an image extension included", (path) => {
    expect(matches(path, { headers: {}, cookies: {} } as never, {})).toBe(true);
  });

  it.each(["/course/x", "/profile", "/"])(
    "still passes the page %s",
    (path) => {
      expect(matches(path, { headers: {}, cookies: {} } as never, {})).toBe(
        true,
      );
    },
  );

  it.each([
    "/favicon.ico",
    "/logo.png",
    "/apix.png",
    "/course/api/x.jpg",
    "/sitemap.xml",
    "/robots.txt",
    "/_next/static/chunk.js",
    "/_next/image",
  ])("keeps %s away from the proxy, as before", (path) => {
    expect(matches(path, { headers: {}, cookies: {} } as never, {})).toBe(
      false,
    );
  });
});
