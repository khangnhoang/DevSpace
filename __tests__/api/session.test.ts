// Test plan
// Goal: the session guard accepts a live session and nothing else, answers 503 when Auth cannot be asked, and caches
//   only positive answers for a short time (AC6).
// Layer: api (the built API with the test-only routes as a process on the test stack, under the network guard). The
//   cache's bound and its cap at the token's `exp` are unit-tested in __tests__/unit/api-session-cache.test.ts,
//   because a real token cannot be made to expire in a second.
// Subject: AC6 of the TM-U3 plan; ADR 0008 D6.
// Data: fixture users created and deleted through the local Admin API; sessions minted from a magic-link token, so no
//   password is typed. A counting proxy between the API and the Auth server turns "Auth was asked" into a number.
// Invariants: a refused token never reaches a handler; a 401 and a 503 carry no user data; a failed Auth call is
//   never remembered.
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  apiTestEnv,
  freePort,
  startApi,
  type RunningApi,
} from "../helpers/api-process";
import {
  apiSessions,
  authCookie,
  bearer,
  forgedToken,
} from "../helpers/api-session";
import {
  startHttpCountingProxy,
  type HttpCountingProxy,
} from "../helpers/http-counting-proxy";

const stack = inject("apiStack");
const AUTH_USER = "/auth/v1/user";
const UNAUTHORIZED = { message: "Unauthorized", statusCode: 401 };
const UNAVAILABLE = { message: "Service Unavailable", statusCode: 503 };

const sessions = apiSessions(stack);
const proxies: HttpCountingProxy[] = [];
const apis: RunningApi[] = [];

async function startWith(extra: Record<string, string | undefined> = {}) {
  const proxy = await startHttpCountingProxy(stack.apiUrl);
  proxies.push(proxy);
  const api = await startApi(
    apiTestEnv(stack, { SUPABASE_URL: proxy.url, ...extra }),
    { fixtures: true },
  );
  apis.push(api);
  return { proxy, api };
}

let main: { proxy: HttpCountingProxy; api: RunningApi };

beforeAll(async () => {
  main = await startWith();
});

afterAll(async () => {
  await sessions.cleanup();
  for (const api of apis) await api.stop();
  for (const proxy of proxies) await proxy.close();
});

type Probe = { proxy: HttpCountingProxy; api: RunningApi };

function whoami(
  target: Probe,
  headers: Record<string, string> = {},
  path = "/api/e2e/whoami",
) {
  return fetch(`${target.api.url}${path}`, { headers });
}

const calls = (target: Probe) => target.proxy.count(AUTH_USER);

describe("session guard (AC6)", () => {
  it("[AC6] accepts a live session from the Authorization header and from the cookie, and returns only the user id", async () => {
    const live = await sessions.mint("live");
    for (const headers of [bearer(live), { cookie: live.cookie }]) {
      const response = await whoami(main, headers);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ userId: live.userId });
    }
  });

  it("[AC6] reads the cookie a browser sends when @supabase/ssr splits it into chunks", async () => {
    const live = await sessions.mint("chunked");
    const value = authCookie({
      access_token: live.accessToken,
      refresh_token: live.refreshToken,
    })
      .split("=")
      .slice(1)
      .join("=");
    const half = Math.floor(value.length / 2);
    const response = await whoami(main, {
      cookie: `sb-127-auth-token.0=${value.slice(0, half)}; sb-127-auth-token.1=${value.slice(half)}`,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: live.userId });
  });

  describe("a token that is not a live session is 401 with no user data", () => {
    const future = () => Math.floor(Date.now() / 1000) + 3600;

    it("[AC6] absent, malformed, expired and alg none are refused before Auth is asked", async () => {
      const before = calls(main);
      const cases: Record<string, string>[] = [
        {},
        { authorization: "Bearer" },
        { authorization: "Bearer abc" },
        { authorization: "Bearer a.b.c" },
        { authorization: "Basic dXNlcjpwYXNz" },
        { cookie: "sb-127-auth-token=base64-not-json" },
        { cookie: "other=1" },
        { authorization: `Bearer ${forgedToken({ exp: 1 })}` },
        {
          authorization: `Bearer ${forgedToken({ exp: Math.floor(Date.now() / 1000) - 5 })}`,
        },
        {
          authorization: `Bearer ${forgedToken({ exp: future(), alg: "none", signature: "x" })}`,
        },
        {
          authorization: `Bearer ${forgedToken({ exp: future(), alg: "None", signature: "x" })}`,
        },
      ];
      for (const headers of cases) {
        const response = await whoami(main, headers);
        expect(response.status, JSON.stringify(headers)).toBe(401);
        expect(await response.json()).toEqual(UNAUTHORIZED);
      }
      expect(calls(main), "none of them reached the Auth server").toBe(before);
    });

    it("[AC6] a token the Auth server did not sign is refused, however good its claims look, and is not remembered", async () => {
      const live = await sessions.mint("unsigned");
      const before = calls(main);
      const claimed = forgedToken({ exp: future(), sub: live.userId });
      for (let round = 1; round <= 2; round += 1) {
        const response = await whoami(main, {
          authorization: `Bearer ${claimed}`,
        });
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual(UNAUTHORIZED);
        expect(calls(main), "a refusal is never cached").toBe(before + round);
      }
    });

    it("[AC6] a real token with its payload changed (tampered) is refused", async () => {
      const live = await sessions.mint("tampered");
      const [header, payload, signature] = live.accessToken.split(".");
      const claims = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      ) as Record<string, unknown>;
      claims.sub = "00000000-0000-0000-0000-000000000009";
      const tampered = [
        header,
        Buffer.from(JSON.stringify(claims)).toString("base64url"),
        signature,
      ].join(".");
      const before = calls(main);
      const response = await whoami(main, {
        authorization: `Bearer ${tampered}`,
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(UNAUTHORIZED);
      expect(calls(main)).toBe(before + 1);
    });

    it("[AC6] a signed-out session is refused", async () => {
      const gone = await sessions.mint("signed-out");
      await sessions.signOut(gone);
      const response = await whoami(main, bearer(gone));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(UNAUTHORIZED);
    });

    it("[AC6] a deleted user's session is refused", async () => {
      const gone = await sessions.mint("deleted");
      await sessions.deleteUser(gone);
      const response = await whoami(main, bearer(gone));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(UNAUTHORIZED);
    });
  });

  describe("an Auth call that fails is 503", () => {
    it.each([500, 502, 503, 429])(
      "[AC6] Auth answering %s gives 503, is never accepted and is never remembered",
      async (status) => {
        const live = await sessions.mint(`down-${status}`);
        const before = calls(main);
        main.proxy.failWith(status);
        try {
          const response = await whoami(main, bearer(live));
          expect(response.status).toBe(503);
          expect(await response.json()).toEqual(UNAVAILABLE);
        } finally {
          main.proxy.failWith(null);
        }
        expect(calls(main)).toBe(before + 1);

        const recovered = await whoami(main, bearer(live));
        expect(recovered.status).toBe(200);
        expect(
          calls(main),
          "the failure left nothing in the cache, so Auth is asked again",
        ).toBe(before + 2);
      },
    );

    it("[AC6] an Auth server that cannot be reached gives 503", async () => {
      const closed = await freePort();
      const live = await sessions.mint("unreachable");
      const api = await startApi(
        apiTestEnv(stack, { SUPABASE_URL: `http://127.0.0.1:${closed}` }),
        { fixtures: true },
      );
      apis.push(api);
      const response = await fetch(`${api.url}/api/e2e/whoami`, {
        headers: bearer(live),
      });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual(UNAVAILABLE);
    });

    it("[AC6] a cached positive answer is not replaced by a failure: Auth is not asked at all", async () => {
      const live = await sessions.mint("cached-then-down");
      expect((await whoami(main, bearer(live))).status).toBe(200);
      const before = calls(main);
      main.proxy.failWith(503);
      try {
        expect((await whoami(main, bearer(live))).status).toBe(200);
      } finally {
        main.proxy.failWith(null);
      }
      expect(calls(main)).toBe(before);
    });
  });

  describe("cache", () => {
    it("[AC6] asks Auth once per token however often it is used, from the header or the cookie", async () => {
      const live = await sessions.mint("cache-once");
      const other = await sessions.mint("cache-other");
      const before = calls(main);
      for (let index = 0; index < 4; index += 1) {
        expect((await whoami(main, bearer(live))).status).toBe(200);
      }
      expect((await whoami(main, { cookie: live.cookie })).status).toBe(200);
      expect(calls(main) - before, "the same token is one key").toBe(1);
      expect((await whoami(main, bearer(other))).status).toBe(200);
      expect(calls(main) - before, "another token is another key").toBe(2);
    });

    it("[AC6] a route marked sensitive skips the cache, before and after the token was cached", async () => {
      const live = await sessions.mint("sensitive");
      const before = calls(main);
      expect((await whoami(main, bearer(live))).status).toBe(200);
      expect(calls(main) - before).toBe(1);
      for (let index = 1; index <= 3; index += 1) {
        const response = await whoami(main, bearer(live), "/api/e2e/sensitive");
        expect(response.status).toBe(200);
        expect(
          calls(main) - before,
          "each sensitive call asks Auth although the token is cached",
        ).toBe(1 + index);
      }
      // The cache still serves the ordinary route, so the sensitive calls neither filled nor flushed it.
      expect((await whoami(main, bearer(live))).status).toBe(200);
      expect(calls(main) - before).toBe(4);
    });

    it("[AC6] a sensitive route sees a sign-out at once, while an ordinary route still trusts its cache for the TTL", async () => {
      const live = await sessions.mint("sensitive-signout");
      expect((await whoami(main, bearer(live))).status).toBe(200);
      await sessions.signOut(live);
      expect((await whoami(main, bearer(live))).status).toBe(200);
      const response = await whoami(main, bearer(live), "/api/e2e/sensitive");
      expect(response.status).toBe(401);
    });

    it("[AC6] a cached answer ends with the TTL and Auth is asked again", async () => {
      const short = await startWith({ E2E_SESSION_CACHE_TTL_MS: "1500" });
      const live = await sessions.mint("ttl");
      expect((await whoami(short, bearer(live))).status).toBe(200);
      expect((await whoami(short, bearer(live))).status).toBe(200);
      expect(calls(short)).toBe(1);

      await sessions.signOut(live);
      expect(
        (await whoami(short, bearer(live))).status,
        "inside the TTL the cached answer still stands",
      ).toBe(200);
      expect(calls(short)).toBe(1);

      await new Promise((resolve) => setTimeout(resolve, 1700));
      const response = await whoami(short, bearer(live));
      expect(response.status, "after the TTL the sign-out is seen").toBe(401);
      expect(calls(short)).toBe(2);
    });
  });
});
