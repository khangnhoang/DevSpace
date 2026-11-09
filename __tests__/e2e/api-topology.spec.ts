// Test plan
// Goal: the two-server topology of TM-U3 works as ADR 0008 D5 says (AC10, AC11, AC19 through Next): `/api/*` is rewritten
//   to the API with the cookie that getUser() refreshed, the server-side helper reaches the API with the app's Origin,
//   a cross-origin write is refused by the API and by Next, and a page render never writes through the API.
// Layer: e2e. Next on 3100 and the e2e build of the API on 3101, both under the server guard. The rows use the
//   test-only fixtures (page.e2e.tsx and its action in the e2e Next build, backend/e2e in the e2e API build): they exist
//   in no production build (AC20) and stay after PR 2.
// Subject: AC10, AC11, AC16, AC19 of the TM-U3 plan.
// Data: the saved student session (read-only here) and one fixture user whose session is refreshed (a refresh rotates
//   the refresh token, which would revoke a saved session another row still uses). The API's own request record says
//   which calls reached it.
// Invariants: a refused write never reaches a handler (it is not in the record or it is a 403); no row prints a token;
//   a signed-in GET render makes no non-GET call to the API.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  request as playwrightRequest,
  type APIRequestContext,
} from "@playwright/test";
import { readTestStack } from "../../scripts/test-stack/read.mjs";
import { E2E_API_ORIGIN, E2E_ORIGIN } from "../helpers/e2e-env";
import { authFile } from "./accounts";
import { expect, test } from "./fixtures";
import { createUserFixture } from "./service-role";

const root = join(__dirname, "../..");
const FIXTURE_ACTIONS = "app/e2e-fixture/fixture-actions.ts";
const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

type CookieJar = { name: string; value: string }[];

const savedCookies = (actor: "student") =>
  (
    JSON.parse(readFileSync(authFile(actor), "utf8")) as {
      cookies: { name: string; value: string; domain: string; path: string }[];
    }
  ).cookies;

// @supabase/ssr stores the session as `base64-<base64url JSON>`, split into 3180-character chunks `.0`, `.1`, ...
function readSessionCookies(cookies: CookieJar): {
  access_token: string;
  refresh_token: string;
} {
  const chunks = cookies
    .map(({ name, value }) => ({
      match: /^sb-.+-auth-token(?:\.(\d+))?$/.exec(name),
      value,
    }))
    .filter((entry) => entry.match)
    .sort((a, b) => Number(a.match![1] ?? 0) - Number(b.match![1] ?? 0));
  const joined = decodeURIComponent(
    chunks.map((entry) => entry.value).join(""),
  );
  return JSON.parse(
    Buffer.from(joined.replace(/^base64-/, ""), "base64url").toString("utf8"),
  );
}

function chunked(name: string, value: string): CookieJar {
  const size = 3180;
  if (value.length <= size) return [{ name, value }];
  const parts: CookieJar = [];
  for (let index = 0; index * size < value.length; index += 1) {
    parts.push({
      name: `${name}.${index}`,
      value: value.slice(index * size, (index + 1) * size),
    });
  }
  return parts;
}

async function contextWith(cookies: CookieJar): Promise<APIRequestContext> {
  return await playwrightRequest.newContext({
    baseURL: E2E_ORIGIN,
    storageState: {
      cookies: cookies.map(({ name, value }) => ({
        name,
        value,
        domain: "127.0.0.1",
        path: "/",
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      })),
      origins: [],
    },
  });
}

const cookieHeader = (cookies: CookieJar) =>
  cookies.map(({ name, value }) => `${name}=${value}`).join("; ");

test.describe("through the rewrite (AC10, AC11)", () => {
  test("[T1] a session that getUser() refreshes reaches the API with the refreshed cookie, and the browser gets it back", async ({
    serverRecords,
  }) => {
    const stack = readTestStack(root);
    const user = await createUserFixture("refresh");
    const anon = createClient(stack.apiUrl, stack.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await anon.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    const session = signedIn.data.session;
    expect(signedIn.error, "the fixture user signs in").toBeNull();
    // The access token is still valid for the API, but the stored `expires_at` is in the past, so getUser() in the proxy
    // must refresh before it answers. The API's digest of the token it received then shows which token came through.
    const stale = {
      ...session,
      expires_at: Math.floor(Date.now() / 1000) - 60,
    };
    const value = `base64-${Buffer.from(JSON.stringify(stale), "utf8").toString("base64url")}`;
    const context = await contextWith(chunked("sb-127-auth-token", value));
    try {
      const refreshesBefore = serverRecords
        .authCalls()
        .filter((call) => call.kind === "refresh").length;
      const response = await context.get("/api/e2e/token");
      expect(response.status()).toBe(200);
      const received = ((await response.json()) as { tokenSha256: string })
        .tokenSha256;

      const refreshes = serverRecords
        .authCalls()
        .filter((call) => call.kind === "refresh");
      expect(refreshes.length, "the proxy refreshed the session").toBe(
        refreshesBefore + 1,
      );
      expect(refreshes.at(-1)?.status).toBe(200);

      const setCookies = response
        .headersArray()
        .filter((header) => header.name.toLowerCase() === "set-cookie")
        .map((header) => header.value.split(";")[0]);
      expect(
        setCookies.length,
        "the browser receives the refreshed cookie",
      ).toBeGreaterThan(0);
      const fresh = readSessionCookies(
        setCookies.map((entry) => ({
          name: entry.slice(0, entry.indexOf("=")),
          value: entry.slice(entry.indexOf("=") + 1),
        })),
      );
      expect(fresh.access_token, "the cookie was really refreshed").not.toBe(
        session!.access_token,
      );
      expect(
        received,
        "the API received the refreshed token, not the stale one",
      ).toBe(sha256(fresh.access_token));
      expect(received).not.toBe(sha256(session!.access_token));
    } finally {
      await context.dispose();
    }
  });

  test("[T2] a server-side POST through the helper reaches the API with the app's Origin and passes", async ({
    callAction,
    serverRecords,
  }) => {
    const result = await callAction(
      "student",
      FIXTURE_ACTIONS,
      "fixturePost",
      [],
    );
    expect(result).toEqual({ status: 201 });
    const posts = serverRecords
      .apiCalls()
      .filter((call) => call.method === "POST");
    expect(posts).toEqual([
      expect.objectContaining({ path: "/api/e2e/mutate", status: 201 }),
    ]);
  });

  test("[T3] the same POST without the helper's Origin is 403", async ({
    serverRecords,
  }) => {
    const cookie = cookieHeader(savedCookies("student"));
    const bare = await fetch(`${E2E_API_ORIGIN}/api/e2e/mutate`, {
      method: "POST",
      headers: { cookie },
    });
    expect(bare.status, "a cookie-bearing write that names no origin").toBe(
      403,
    );
    const withOrigin = await fetch(`${E2E_API_ORIGIN}/api/e2e/mutate`, {
      method: "POST",
      headers: { cookie, origin: E2E_ORIGIN },
    });
    expect(withOrigin.status, "the helper's Origin is what makes it pass").toBe(
      201,
    );
    expect(serverRecords.apiCalls().map((call) => call.status)).toEqual([
      403, 201,
    ]);
  });

  test("[T4] a cross-origin POST from a page straight to the API is 403", async ({
    browser,
    serverRecords,
  }) => {
    const context = await browser.newContext({
      storageState: authFile("student"),
    });
    try {
      const page = await context.newPage();
      await page.goto("/login");
      // No CORS: the answer is opaque to the page, so the outcome is read from the API's own record.
      await page.evaluate(async (target) => {
        await fetch(target, {
          method: "POST",
          credentials: "include",
          mode: "no-cors",
          body: "x",
        });
      }, `${E2E_API_ORIGIN}/api/e2e/mutate`);
      await expect.poll(() => serverRecords.apiCalls().length).toBe(1);
      expect(serverRecords.apiCalls()).toEqual([
        expect.objectContaining({
          method: "POST",
          path: "/api/e2e/mutate",
          status: 403,
        }),
      ]);
    } finally {
      await context.close();
    }
  });

  test("[T5] a cross-origin POST to a server action is refused by Next and the API records no call", async ({
    callAction,
    callActionRefused,
    serverRecords,
  }) => {
    // Control: from the app's own origin the same action runs and the API records its write.
    expect(
      await callAction("student", FIXTURE_ACTIONS, "fixturePost", []),
    ).toEqual({ status: 201 });
    const writes = () =>
      serverRecords.apiCalls().filter((call) => call.method === "POST").length;
    const before = writes();
    expect(before).toBe(1);

    const refusal = await callActionRefused(
      "student",
      FIXTURE_ACTIONS,
      "fixturePost",
      [],
      {
        origin: "http://evil.example",
        statuses: [500],
        // Next's own report of the refusal: the origin header does not match the host, so it aborts the action.
        identified: () =>
          /does not match `origin` header with value `evil\.example` from a forwarded Server Actions request\. Aborting the action\.[\s\S]*Invalid Server Actions request/.test(
            serverRecords.nextLog(),
          ),
      },
    );
    expect(refusal.body).not.toContain("201");
    expect(writes(), "the refused call never reached the API").toBe(before);
  });
});

// The routes of the build under test, read from its manifest, with a sample value for each dynamic segment. A new
// dynamic route has no sample, so the row fails until one is added: no route is skipped by omission.
const SAMPLES: Record<string, string> = {
  "[slug]": "javascript-can-ban",
  "[course]": "javascript-can-ban",
};
const NOT_PAGES = new Set([
  "/_global-error",
  "/_not-found",
  "/auth/callback",
  "/icon.png",
]);

function renderedRoutes(): string[] {
  const manifest = JSON.parse(
    readFileSync(join(root, ".next", "app-path-routes-manifest.json"), "utf8"),
  ) as Record<string, string>;
  return Object.values(manifest)
    .filter((route) => !NOT_PAGES.has(route))
    .map((route) =>
      route.replace(/\[[^\]]+\]/g, (segment) => {
        const sample = SAMPLES[segment];
        if (!sample)
          throw new Error(
            `route ${route} has a dynamic segment ${segment} with no sample value in api-topology.spec.ts`,
          );
        return sample;
      }),
    );
}

test.describe("page renders never write through the API (AC11)", () => {
  test.use({ storageState: authFile("student") });

  test("[T6] a signed-in GET render of every route makes no non-GET call to the API", async ({
    page,
    serverRecords,
  }) => {
    // About twenty pages, some of them heavy (the editor of /try_it), each rendered once.
    test.setTimeout(240_000);
    const routes = renderedRoutes();
    expect(
      routes,
      "the manifest lists the fixture page, which reads",
    ).toContain("/e2e-fixture");
    for (const route of routes) {
      await page.goto(route, { waitUntil: "load" });
    }
    const calls = serverRecords.apiCalls();
    expect(
      calls.map((call) => call.path),
      "the fixture page rendered and called the API, so the record is live",
    ).toContain("/api/e2e/whoami");
    expect(calls.filter((call) => call.method !== "GET")).toEqual([]);
  });
});

test.describe("the temporary proof page (AC19)", () => {
  test.use({ storageState: authFile("student") });

  test("[T7] /tm-u3-proof renders for the proof owner and calls the API with GET only", async ({
    page,
    serverRecords,
  }) => {
    const response = await page.goto("/tm-u3-proof");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("session: 200")).toBeVisible();
    await expect(page.getByText("session-cold: 200")).toBeVisible();
    await expect(page.getByText("read: 200")).toBeVisible();
    expect(
      serverRecords
        .apiCalls()
        .map((call) => `${call.method} ${call.path} ${call.status}`),
    ).toEqual([
      "GET /api/session 200",
      "GET /api/proof/session-cold 200",
      "GET /api/proof/read 200",
    ]);
  });
});

test.describe("the temporary proof page for a session that is not the proof owner (AC19)", () => {
  test.use({ storageState: authFile("learner") });

  test("[T8] /tm-u3-proof is 404 because the API answers 404", async ({
    page,
    serverRecords,
  }) => {
    const response = await page.goto("/tm-u3-proof");
    expect(response?.status()).toBe(404);
    expect(
      serverRecords.apiCalls().map((call) => `${call.path} ${call.status}`),
    ).toEqual(["/api/session 404"]);
  });
});

test.describe("the private API address", () => {
  test("[T9] is in no file the browser can download", async () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(js|css|html|json|map)$/.test(entry)) files.push(full);
      }
    };
    walk(join(root, ".next", "static"));
    expect(files.length, "the client bundle exists").toBeGreaterThan(0);
    const leaks = files.filter((file) => {
      const text = readFileSync(file, "utf8");
      return (
        text.includes("API_INTERNAL_URL") ||
        text.includes(E2E_API_ORIGIN) ||
        text.includes("127.0.0.1:3101")
      );
    });
    expect(leaks).toEqual([]);
  });
});
