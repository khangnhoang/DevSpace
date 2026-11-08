// Test plan
// Goal: the temporary proof surfaces of TM-U3 (plan 1.2) are gated exactly as AC19 says, in the order the plan fixes:
//   proof flag, CSRF, session, proof owner, then the body, validation and the handler; and they do what T1 to T5 need.
// Layer: api (the production build `dist` as a process on the test stack, under the network guard). A counting proxy
//   between the API and the Auth server turns "the session guard never ran" into a number.
// Subject: AC19, AC5 and the guard order of the TM-U3 plan; ADR 0008 D5, D6.
// Data: two fixture users (the proof owner and another), created and deleted through the local Admin API.
// Invariants: with the flag off no proof route exists for any caller and no guard runs; with it on, a cross-site write is
//   403 before any owner check, a session that is not the owner (or every session when no owner is set) is 404, and a
//   non-owner's body is never read; no response carries a row, a body or a token; no body is logged (G5).
import { createConnection } from "node:net";
import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { afterAllCleanup } from "../helpers/api-timeout-note";
import { API_TEMPORARY_ROUTES } from "../../scripts/tm-u3-proof/routes.mjs";
import { runProof } from "../../scripts/tm-u3-proof/run.mjs";
import { verifyAbsent } from "../../scripts/tm-u3-proof/verify.mjs";
import {
  apiTestEnv,
  runApiToExit,
  startApi,
  type RunningApi,
} from "../helpers/api-process";
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
const MIB = 1024 * 1024;
const ORIGIN = "http://127.0.0.1:3100";
const AUTH_USER = "/auth/v1/user";
const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

const sessions = apiSessions(stack);
const proxies: HttpCountingProxy[] = [];
const apis: RunningApi[] = [];

type Server = { api: RunningApi; proxy: HttpCountingProxy };
let off: Server;
let on: Server;
let ownerless: Server;
let owner: MintedSession;
let other: MintedSession;
// The three long waits start as soon as the API is up and are read by the rows that follow, so the 65 seconds overlap
// the other rows instead of adding to them.
type Slow = { status: number; body: string; tookMs: number };
let slow: Record<number, Promise<Slow>>;

async function start(
  extra: Record<string, string | undefined>,
): Promise<Server> {
  const proxy = await startHttpCountingProxy(stack.apiUrl);
  proxies.push(proxy);
  // The production build, not the e2e one: the surfaces must work, and be absent, in what ships.
  const api = await startApi(
    apiTestEnv(stack, { SUPABASE_URL: proxy.url, ...extra }),
  );
  apis.push(api);
  return { api, proxy };
}

beforeAll(async () => {
  owner = await sessions.mint("proof-owner");
  other = await sessions.mint("proof-other");
  off = await start({ API_PROOF_USER_ID: owner.userId });
  on = await start({ API_PROOF_ENABLED: "1", API_PROOF_USER_ID: owner.userId });
  ownerless = await start({ API_PROOF_ENABLED: "1" });
  slow = Object.fromEntries(
    [35, 58, 65].map((seconds) => [
      seconds,
      (async () => {
        const started = Date.now();
        const response = await fetch(
          `${on.api.url}/api/proof/slow?seconds=${seconds}`,
          { headers: bearer(owner) },
        );
        return {
          status: response.status,
          body: await response.text(),
          tookMs: Date.now() - started,
        };
      })(),
    ]),
  );
});

afterAll(
  afterAllCleanup("proof gate", () => [
    () => sessions.cleanup(),
    ...apis.map((api) => () => api.stop()),
    ...proxies.map((proxy) => () => proxy.close()),
  ]),
);

const authCalls = (server: Server) => server.proxy.count(AUTH_USER);

// Every temporary route, with a method that fits it. `slow` is asked for 35 seconds, which a 404 never waits for.
const ROUTES = API_TEMPORARY_ROUTES.map(({ method, path }) => ({
  method,
  path: path === "/api/proof/slow" ? `${path}?seconds=35` : path,
}));

function call(
  server: Server,
  route: { method: string; path: string },
  headers: Record<string, string> = {},
  body?: BodyInit,
) {
  return fetch(`${server.api.url}${route.path}`, {
    method: route.method,
    headers,
    body: route.method === "POST" ? (body ?? "x") : undefined,
  });
}

describe("flag off (AC19)", () => {
  const callers: [string, () => Record<string, string>][] = [
    ["no credentials", () => ({})],
    ["the proof owner's bearer token", () => bearer(owner)],
    [
      "the proof owner's cookie",
      () => ({ cookie: owner.cookie, origin: ORIGIN }),
    ],
    [
      "a cross-site write with the owner's cookie",
      () => ({ cookie: owner.cookie, "sec-fetch-site": "cross-site" }),
    ],
    ["another user's token", () => bearer(other)],
  ];

  it.each(callers)(
    "[AC19] every temporary route is 404 for %s, although API_PROOF_USER_ID is set",
    async (_name, headers) => {
      for (const route of ROUTES) {
        const response = await call(off, route, headers());
        expect(response.status, `${route.method} ${route.path}`).toBe(404);
        await response.body?.cancel();
      }
      expect(authCalls(off), "no guard ran: Auth was never asked").toBe(0);
    },
  );

  it("[AC19] the verify mode of the proof script finds nothing to report", async () => {
    const result = await verifyAbsent({ apiBase: off.api.url });
    expect(result.failures).toEqual([]);
    expect(result.checked).toBe(API_TEMPORARY_ROUTES.length);
  });

  it("[AC5] the production build with the flag off registers exactly the two health routes", () => {
    const routes = enumerateRoutes("dist", { API_PROOF_USER_ID: owner.userId });
    expect(routes.registered.sort()).toEqual([
      "GET /api/health",
      "GET /api/health/db",
    ]);
    expect(routes.declared.every((route) => route.public)).toBe(true);
  });

  it("[AC19] a flag that is not exactly 1, and an owner that is not a user id, stop the process at startup", async () => {
    for (const env of [
      { API_PROOF_ENABLED: "true" },
      { API_PROOF_ENABLED: "0" },
      { API_PROOF_ENABLED: "yes" },
      { API_PROOF_ENABLED: "1", API_PROOF_USER_ID: "not-a-user-id" },
    ]) {
      const result = await runApiToExit(apiTestEnv(stack, env));
      expect(result.listened, JSON.stringify(env)).toBe(false);
      expect(result.code, JSON.stringify(env)).not.toBe(0);
      expect(result.output).toMatch(/API_PROOF_(ENABLED|USER_ID)/);
    }
  });
});

describe("flag on: what is registered (AC5)", () => {
  it("[AC5] exactly the temporary routes are added, none of them public, and the public set is still the two health routes", () => {
    const routes = enumerateRoutes("dist", {
      API_PROOF_ENABLED: "1",
      API_PROOF_USER_ID: owner.userId,
    });
    const temporary = routes.declared.filter((route) => !route.public);
    expect(
      temporary.map((route) => `${route.method} ${route.path}`).sort(),
    ).toEqual(
      API_TEMPORARY_ROUTES.map(
        ({ method, path }) => `${method} ${path}`,
      ).sort(),
    );
    expect(
      routes.declared
        .filter((route) => route.public)
        .map((route) => route.path),
    ).toEqual(["/api/health", "/api/health/db"]);
  });

  it("[AC19] the verify mode of the proof script fails for every route while the flag is on, whatever the status", async () => {
    const result = await verifyAbsent({ apiBase: on.api.url });
    expect(result.failures).toHaveLength(API_TEMPORARY_ROUTES.length);
    expect(result.failures.every((failure) => failure.status === 401)).toBe(
      true,
    );
  });
});

describe("flag on: the order of the guards (AC19)", () => {
  it("[AC19] a cross-site write is 403 before any owner check, from the owner and from another user, and Auth is not asked", async () => {
    const before = authCalls(on);
    for (const session of [owner, other]) {
      for (const route of ROUTES.filter((entry) => entry.method === "POST")) {
        const response = await call(on, route, {
          cookie: session.cookie,
          "sec-fetch-site": "cross-site",
        });
        expect(response.status, `${route.path}`).toBe(403);
        await response.body?.cancel();
      }
    }
    expect(authCalls(on)).toBe(before);
  });

  it("[AC19] a request with no session is 401, before the owner check", async () => {
    for (const route of ROUTES) {
      const response = await call(on, route);
      expect(response.status, `${route.method} ${route.path}`).toBe(401);
      await response.body?.cancel();
    }
  });

  it("[AC19] a live session that is not the proof owner is 404 on every route, by bearer token and by cookie", async () => {
    for (const headers of [
      bearer(other),
      { cookie: other.cookie, origin: ORIGIN },
    ]) {
      for (const route of ROUTES) {
        const response = await call(on, route, headers);
        expect(response.status, `${route.method} ${route.path}`).toBe(404);
        await response.body?.cancel();
      }
    }
  });

  it("[AC19] a non-owner's body is never read: 4 MiB + 1 is 404, where the owner gets 413", async () => {
    const big = randomBytes(4 * MIB + 1);
    const refused = await call(
      on,
      { method: "POST", path: "/api/proof/echo" },
      { ...bearer(other), "content-type": "application/octet-stream" },
      big,
    );
    expect(refused.status).toBe(404);
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(2 * MIB + 1)]), "file.bin");
    const upload = await call(
      on,
      { method: "POST", path: "/api/proof/upload" },
      bearer(other),
      form,
    );
    expect(upload.status).toBe(404);
    const owned = await call(
      on,
      { method: "POST", path: "/api/proof/echo" },
      { ...bearer(owner), "content-type": "application/octet-stream" },
      big,
    );
    expect(owned.status, "the same body from the owner reaches the limit").toBe(
      413,
    );
  });

  it("[AC19] with no API_PROOF_USER_ID every session, the one that would be the owner included, is 404", async () => {
    for (const route of ROUTES) {
      for (const headers of [bearer(owner), bearer(other)]) {
        const response = await call(ownerless, route, headers);
        expect(response.status, `${route.method} ${route.path}`).toBe(404);
        await response.body?.cancel();
      }
    }
  });
});

describe("flag on: the proof owner (T1 to T5)", () => {
  it("[T3] /api/session answers the user id and nothing else, and uses the cache", async () => {
    const before = authCalls(on);
    for (let index = 0; index < 3; index += 1) {
      const response = await call(
        on,
        { method: "GET", path: "/api/session" },
        bearer(owner),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ userId: owner.userId });
    }
    expect(
      authCalls(on) - before,
      "one Auth call however often it is used",
    ).toBeLessThanOrEqual(1);
  });

  it("[T3] /api/proof/session-cold asks Auth on every call", async () => {
    const before = authCalls(on);
    for (let index = 1; index <= 3; index += 1) {
      const response = await call(
        on,
        { method: "GET", path: "/api/proof/session-cold" },
        bearer(owner),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ userId: owner.userId });
      expect(authCalls(on) - before).toBe(index);
    }
  });

  it("[T2] /api/proof/read reads the caller's own row twice through the API role and answers only ok", async () => {
    const response = await call(
      on,
      { method: "GET", path: "/api/proof/read" },
      bearer(owner),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  const echo = (body: BodyInit, headers: Record<string, string> = {}) =>
    call(
      on,
      { method: "POST", path: "/api/proof/echo" },
      { ...bearer(owner), ...headers },
      body,
    );

  it("[T1] the echo hash is over the bytes received, not over a re-serialized document", async () => {
    // Whitespace, key order and an escape that JSON.stringify would write differently.
    const text = '{ "b": 1,\n  "a": [1, 2,3], "u": "\\u00e9" }';
    const bytes = Buffer.from(text);
    const response = await echo(text, { "content-type": "application/json" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      length: bytes.length,
      sha256: sha256(bytes),
    });
    expect(sha256(Buffer.from(JSON.stringify(JSON.parse(text))))).not.toBe(
      sha256(bytes),
    );
  });

  it("[T1] bytes that are not text, an empty body and exactly 4 MiB are hashed as received", async () => {
    for (const bytes of [
      Buffer.from([0xff, 0xfe, 0x00, 0x80, 0xc3, 0x28]),
      Buffer.alloc(0),
      randomBytes(4 * MIB),
    ]) {
      const response = await echo(bytes, {
        "content-type": "application/octet-stream",
      });
      expect(response.status, `${bytes.length} bytes`).toBe(200);
      expect(await response.json()).toEqual({
        length: bytes.length,
        sha256: sha256(bytes),
      });
    }
  });

  it("[T1] the same hash through the cookie of a browser, with the app's Origin", async () => {
    const bytes = randomBytes(1000);
    const response = await call(
      on,
      { method: "POST", path: "/api/proof/echo" },
      { cookie: owner.cookie, origin: ORIGIN, "content-type": "text/plain" },
      bytes,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      length: 1000,
      sha256: sha256(bytes),
    });
  });

  it("[T1] one byte over 4 MiB is 413 and a body shorter than its Content-Length is 400, never hashed", async () => {
    const over = await echo(randomBytes(4 * MIB + 1), {
      "content-type": "application/octet-stream",
    });
    expect(over.status).toBe(413);

    const status = await new Promise<number | null>((resolve, reject) => {
      const socket = createConnection({ host: "127.0.0.1", port: on.api.port });
      let text = "";
      socket.setEncoding("utf8");
      socket.on("data", (chunk) => (text += chunk));
      socket.on("error", reject);
      socket.on("close", () => {
        const match = /^HTTP\/1\.1 (\d{3})/.exec(text);
        resolve(match ? Number(match[1]) : null);
      });
      socket.write(
        [
          "POST /api/proof/echo HTTP/1.1",
          `Host: 127.0.0.1:${on.api.port}`,
          `Authorization: Bearer ${owner.accessToken}`,
          "Content-Type: application/octet-stream",
          "Content-Length: 100",
          "Connection: close",
          "",
          "short",
        ].join("\r\n"),
      );
      socket.end();
      setTimeout(() => socket.destroy(), 10_000);
    });
    expect(status).toBe(400);
  });

  it("[T1] the body is neither stored nor logged (G5): a marker sent to the echo and the upload is in no output", async () => {
    const marker = `body-marker-${randomBytes(6).toString("hex")}`;
    expect((await echo(marker, { "content-type": "text/plain" })).status).toBe(
      200,
    );
    const form = new FormData();
    form.append("file", new Blob([marker]), "file.txt");
    const upload = await call(
      on,
      { method: "POST", path: "/api/proof/upload" },
      bearer(owner),
      form,
    );
    expect(upload.status).toBe(200);
    expect(on.api.output()).not.toContain(marker);
  });

  it("[T1] the upload hash is over the file's bytes; 2 MiB passes, one byte more is 413 and an oversized text field is 400", async () => {
    const upload = (form: FormData) =>
      call(
        on,
        { method: "POST", path: "/api/proof/upload" },
        bearer(owner),
        form,
      );
    const bytes = randomBytes(2 * MIB);
    const form = new FormData();
    form.append("file", new Blob([bytes]), "file.bin");
    const exact = await upload(form);
    expect(exact.status).toBe(200);
    expect(await exact.json()).toEqual({
      length: 2 * MIB,
      sha256: sha256(bytes),
    });

    const over = new FormData();
    over.append("file", new Blob([new Uint8Array(2 * MIB + 1)]), "file.bin");
    expect((await upload(over)).status).toBe(413);

    const field = new FormData();
    field.append("note", "x".repeat(64 * 1024 + 1));
    field.append("file", new Blob([new Uint8Array(10)]), "file.bin");
    expect((await upload(field)).status).toBe(400);
  });

  it.each(["", "0", "36", "35.5", "abc", "-35", "3500"])(
    "[T4] /api/proof/slow accepts only 35, 58 and 65 seconds: %j is 400 and waits for nothing",
    async (seconds) => {
      const started = Date.now();
      const response = await call(
        on,
        { method: "GET", path: `/api/proof/slow?seconds=${seconds}` },
        bearer(owner),
      );
      expect(response.status).toBe(400);
      expect(Date.now() - started).toBeLessThan(2000);
    },
  );

  it("[T4] /api/proof/slow without the parameter is 400", async () => {
    const response = await call(
      on,
      { method: "GET", path: "/api/proof/slow" },
      bearer(owner),
    );
    expect(response.status).toBe(400);
  });

  it("[T4] the stream sends its chunks as they are written, not all at the end; the Observable timeout does not govern it", async () => {
    const started = Date.now();
    const response = await call(
      on,
      { method: "GET", path: "/api/proof/stream" },
      bearer(owner),
    );
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    const arrivals: number[] = [];
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      arrivals.push(Date.now() - started);
      text += Buffer.from(value).toString("utf8");
    }
    expect(text.trim().split("\n")).toHaveLength(10);
    expect(
      arrivals[0],
      "the first chunk arrives long before the end",
    ).toBeLessThan(1500);
    expect(
      arrivals.at(-1)!,
      "the last one arrives after about five seconds",
    ).toBeGreaterThan(4000);
    expect(arrivals.length, "more than one read").toBeGreaterThan(3);
  });

  it("[T4] a wait of 35 seconds and one of 58 finish with 200, a wait of 65 is ended with the explicit 504 at 60 seconds", async () => {
    const [short, nearly, over] = await Promise.all([
      slow[35],
      slow[58],
      slow[65],
    ]);
    expect(short.status).toBe(200);
    expect(JSON.parse(short.body)).toEqual({ waitedSeconds: 35 });
    expect(short.tookMs).toBeGreaterThanOrEqual(34_000);
    expect(nearly.status).toBe(200);
    expect(JSON.parse(nearly.body)).toEqual({ waitedSeconds: 58 });
    expect(nearly.tookMs).toBeGreaterThanOrEqual(57_000);
    expect(over.status).toBe(504);
    expect(JSON.parse(over.body)).toEqual({
      message: "The request took too long and was ended.",
      error: "Gateway Timeout",
      statusCode: 504,
    });
    expect(
      over.tookMs,
      "ended at the limit, not when the wait finished",
    ).toBeGreaterThanOrEqual(59_000);
    expect(over.tookMs).toBeLessThan(63_000);
  }, 120_000);

  it("[T5] the run mode of the proof script passes every check against this API", async () => {
    const outcome = await runProof({
      apiBase: on.api.url,
      cookie: owner.cookie,
      origin: ORIGIN,
      skipSlow: true,
    });
    expect(outcome.lines.filter((line) => line.startsWith("FAIL"))).toEqual([]);
    expect(outcome.failed).toBe(0);
    expect(outcome.lines.length).toBeGreaterThanOrEqual(10);
    expect(outcome.lines.join("\n")).not.toContain(owner.accessToken);
  });
});
