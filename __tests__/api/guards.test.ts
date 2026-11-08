// Test plan
// Goal: every route of the API requires a session unless it is marked public (AC5), and the CSRF guard refuses a
//   cross-site request before the session guard looks at it (AC7).
// Layer: api (the built API with the test-only routes as a process on the test stack, under the network guard).
// Subject: AC5, AC7 of the TM-U3 plan; ADR 0008 D5.
// Data: one fixture user, created and deleted through the local Admin API. A counting proxy sits between the API and
//   the Auth server, so "the session guard never ran" is read from the number of Auth calls.
// Invariants: a refused request never reaches a handler (read from the handler counter); the Auth server is asked
//   only for a request that passed the CSRF guard.
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { afterAllCleanup } from "../helpers/api-timeout-note";
import { apiTestEnv, startApi, type RunningApi } from "../helpers/api-process";
import { enumerateRoutes } from "../helpers/api-routes";
import {
  apiSessions,
  bearer,
  type MintedSession,
} from "../helpers/api-session";
import {
  startHttpCountingProxy,
  type HttpCountingProxy,
} from "../helpers/http-counting-proxy";

const stack = inject("apiStack");
const ORIGIN = "http://127.0.0.1:3100";
const FOREIGN = "http://127.0.0.1:3999";
const AUTH_USER = "/auth/v1/user";

const sessions = apiSessions(stack);
let proxy: HttpCountingProxy;
let api: RunningApi;
let user: MintedSession;

beforeAll(async () => {
  proxy = await startHttpCountingProxy(stack.apiUrl);
  api = await startApi(apiTestEnv(stack, { SUPABASE_URL: proxy.url }), {
    fixtures: true,
  });
  user = await sessions.mint("guards");
});

afterAll(
  afterAllCleanup("guards", () => [
    () => sessions.cleanup(),
    () => api?.stop(),
    () => proxy?.close(),
  ]),
);

const authCalls = () => proxy.count(AUTH_USER);

async function handled(): Promise<number> {
  const response = await fetch(`${api.url}/api/e2e/handled`, {
    headers: bearer(user),
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { handled: number }).handled;
}

describe("default deny (AC5)", () => {
  it("[AC5] the production build registers exactly /api/health and /api/health/db, both public", () => {
    const routes = enumerateRoutes("dist");
    expect(routes.declared).toEqual([
      { method: "GET", path: "/api/health", public: true },
      { method: "GET", path: "/api/health/db", public: true },
    ]);
    expect(routes.registered.sort()).toEqual([
      "GET /api/health",
      "GET /api/health/db",
    ]);
  });

  it("[AC5] with the test-only routes added, the public set is still exactly the two health routes", () => {
    const routes = enumerateRoutes("dist-e2e");
    const publicRoutes = routes.declared
      .filter((route) => route.public)
      .map((route) => `${route.method} ${route.path}`);
    expect(publicRoutes).toEqual(["GET /api/health", "GET /api/health/db"]);

    const privateRoutes = routes.declared.filter((route) => !route.public);
    expect(
      privateRoutes.map((route) => route.path),
      "the route that carries no marker is registered and denied, so the row cannot pass because nothing was enumerated",
    ).toContain("/api/e2e/private");
    expect(privateRoutes.length).toBeGreaterThan(5);

    // The declared list is read from controller metadata; the registered list is what Express really serves.
    expect(
      routes.declared.map((route) => `${route.method} ${route.path}`).sort(),
    ).toEqual(routes.registered.sort());
  });

  it("[AC5] every registered route that is not public refuses a request with no session, and the public ones answer", async () => {
    const routes = enumerateRoutes("dist-e2e").declared;
    for (const route of routes) {
      const response = await fetch(`${api.url}${route.path}`, {
        method: route.method,
        headers: { "content-type": "application/json" },
        body: route.method === "GET" ? undefined : "{}",
      });
      if (route.public) {
        expect(response.status, `${route.method} ${route.path}`).toBe(200);
      } else {
        expect(response.status, `${route.method} ${route.path}`).toBe(401);
        expect(await response.json()).toEqual({
          message: "Unauthorized",
          statusCode: 401,
        });
      }
    }
    expect(authCalls(), "no token was sent, so Auth was never asked").toBe(0);
  });

  it("[AC5] a route with no marker answers 401 without a session and 200 with one", async () => {
    expect((await fetch(`${api.url}/api/e2e/private`)).status).toBe(401);
    const live = await fetch(`${api.url}/api/e2e/private`, {
      headers: bearer(user),
    });
    expect(live.status).toBe(200);
  });
});

describe("the body is read only after the guards (AC7)", () => {
  const MIB = 1024 * 1024;
  // A JSON document one byte over the 4 MiB limit.
  const oversized = `{"a":"${"x".repeat(4 * MIB + 1 - '{"a":""}'.length)}"}`;
  const crossSite = () => ({
    "content-type": "application/json",
    cookie: user.cookie,
    "sec-fetch-site": "cross-site",
  });

  it("[AC7] a cross-site cookie POST with malformed JSON is 403, not the parser's 400", async () => {
    const before = await handled();
    for (const body of ["{", "null", "leak-marker is not json"]) {
      const response = await fetch(`${api.url}/api/e2e/validate`, {
        method: "POST",
        headers: crossSite(),
        body,
      });
      expect(response.status, body).toBe(403);
    }
    expect(await handled()).toBe(before);
  });

  it("[AC7] a cross-site cookie POST over 4 MiB is 403, not the parser's 413", async () => {
    const before = await handled();
    const response = await fetch(`${api.url}/api/e2e/json`, {
      method: "POST",
      headers: crossSite(),
      body: oversized,
    });
    expect(response.status).toBe(403);
    expect(await handled()).toBe(before);
  });

  it("[AC7] a POST with no session and a body over 4 MiB is 401, and the body is not buffered", async () => {
    const before = await handled();
    const response = await fetch(`${api.url}/api/e2e/json`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: oversized,
    });
    expect(response.status).toBe(401);
    expect(await handled()).toBe(before);
  });

  it("[AC7] a POST to a path with no route and a body over 4 MiB is 404, not the parser's 413", async () => {
    const response = await fetch(`${api.url}/api/e2e/no-such-route`, {
      method: "POST",
      headers: { "content-type": "application/json", ...bearer(user) },
      body: oversized,
    });
    expect(response.status).toBe(404);
  });
});

type Case = {
  name: string;
  headers: Record<string, string>;
  status: number;
};

const cookie = () => ({ cookie: user.cookie });
// A POST that passes every guard is "created" (Nest's default for POST).
const OK = 201;

describe("CSRF guard (AC7)", () => {
  // Every row sends a non-GET request with the valid session cookie, so the status is decided by the headers alone.
  const cookieCases: Case[] = [
    {
      name: "Sec-Fetch-Site cross-site",
      headers: { "sec-fetch-site": "cross-site", origin: ORIGIN },
      status: 403,
    },
    {
      name: "Sec-Fetch-Site same-site",
      headers: { "sec-fetch-site": "same-site", origin: ORIGIN },
      status: 403,
    },
    {
      name: "Sec-Fetch-Site none",
      headers: { "sec-fetch-site": "none" },
      status: 403,
    },
    {
      name: "Sec-Fetch-Site same-origin with an allowed Origin",
      headers: { "sec-fetch-site": "same-origin", origin: ORIGIN },
      status: OK,
    },
    {
      name: "Sec-Fetch-Site same-origin and no Origin",
      headers: { "sec-fetch-site": "same-origin" },
      status: OK,
    },
    {
      name: "Sec-Fetch-Site same-origin with a foreign Origin",
      headers: { "sec-fetch-site": "same-origin", origin: FOREIGN },
      status: 403,
    },
    {
      name: "no Sec-Fetch-Site and an allowed Origin",
      headers: { origin: ORIGIN },
      status: OK,
    },
    {
      name: "no Sec-Fetch-Site and a foreign Origin",
      headers: { origin: FOREIGN },
      status: 403,
    },
    {
      name: "no Sec-Fetch-Site and Origin null",
      headers: { origin: "null" },
      status: 403,
    },
    { name: "neither header", headers: {}, status: 403 },
  ];

  it.each(cookieCases)(
    "[AC7] a cookie POST with $name answers $status",
    async ({ headers, status }) => {
      const before = await handled();
      const response = await fetch(`${api.url}/api/e2e/mutate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...cookie(),
          ...headers,
        },
        body: "{}",
      });
      expect(response.status).toBe(status);
      expect(
        (await handled()) - before,
        status === 403
          ? "a refused request never reaches the handler"
          : "an allowed request reaches the handler once",
      ).toBe(status === 403 ? 0 : 1);
    },
  );

  it("[AC7] a cross-site POST that carries both the cookie and Authorization is 403", async () => {
    const before = await handled();
    const variants: Record<string, string>[] = [
      { "sec-fetch-site": "cross-site" },
      { origin: FOREIGN },
      {},
    ];
    for (const headers of variants) {
      const response = await fetch(`${api.url}/api/e2e/mutate`, {
        method: "POST",
        headers: { ...cookie(), ...bearer(user), ...headers },
      });
      expect(response.status, JSON.stringify(headers)).toBe(403);
    }
    expect(await handled()).toBe(before);
  });

  it("[AC7] a request authenticated only by Authorization: Bearer, with no cookie, skips the guard", async () => {
    const before = await handled();
    const variants: Record<string, string>[] = [
      { "sec-fetch-site": "cross-site" },
      {},
    ];
    for (const headers of variants) {
      const response = await fetch(`${api.url}/api/e2e/mutate`, {
        method: "POST",
        headers: { ...bearer(user), ...headers },
      });
      expect(response.status, JSON.stringify(headers)).toBe(OK);
    }
    expect(await handled()).toBe(before + 2);
  });

  it("[AC7] a POST with neither cookie nor Authorization is refused by the session guard, not served", async () => {
    const response = await fetch(`${api.url}/api/e2e/mutate`, {
      method: "POST",
    });
    expect(response.status).toBe(401);
  });

  it("[AC7] a GET that carries the cookie is not subject to the guard", async () => {
    const response = await fetch(`${api.url}/api/e2e/whoami`, {
      headers: { ...cookie(), "sec-fetch-site": "cross-site" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: user.userId });
  });

  it("[AC7] a refused cross-site request is 403 with an invalid cookie, and the Auth server is never asked", async () => {
    const before = authCalls();
    const response = await fetch(`${api.url}/api/e2e/mutate`, {
      method: "POST",
      headers: {
        cookie: "sb-127-auth-token=not-a-session",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(response.status, "the session guard would have said 401").toBe(403);
    const forged = await fetch(`${api.url}/api/e2e/mutate`, {
      method: "POST",
      headers: { cookie: user.cookie.replace(/.$/, "x"), origin: FOREIGN },
    });
    expect(forged.status).toBe(403);
    expect(authCalls()).toBe(before);
  });

  it("[AC7] a refused cross-site request is 403 while Auth is unavailable, and an allowed one is 503", async () => {
    // A token the API has not seen: a cached one would be served without asking Auth.
    const fresh = await sessions.mint("guards-down");
    proxy.failWith(503);
    try {
      const before = authCalls();
      const refused = await fetch(`${api.url}/api/e2e/mutate`, {
        method: "POST",
        headers: { cookie: fresh.cookie, "sec-fetch-site": "cross-site" },
      });
      expect(refused.status, "the session guard would have said 503").toBe(403);
      expect(authCalls()).toBe(before);

      const allowed = await fetch(`${api.url}/api/e2e/mutate`, {
        method: "POST",
        headers: { cookie: fresh.cookie, "sec-fetch-site": "same-origin" },
      });
      expect(
        allowed.status,
        "Auth really is down for a request the guard lets through",
      ).toBe(503);
      expect(authCalls()).toBe(before + 1);
    } finally {
      proxy.failWith(null);
    }
  });
});
