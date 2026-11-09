// Test plan
// Goal: the measure, session-probe and refresh-race modes and the truncated-body sender of scripts/tm-u3-proof report what
//   the plan's M1, M2, T3 and T5 ask for, and print nothing that identifies a session (G5, G6).
// Layer: unit. The libraries with a fake fetch, a real local TCP server for the truncated body, and the command itself.
// Subject: TM-U3 plan 1.1 (M1, M2, T3, T5).
// Invariants: every route of M1 gets 100 sequential and 20 concurrent samples; the API figure is the Server-Timing span,
//   and "n/a" where a route sends none; a budget that is exceeded fails (the post-TM-U11 one only informs); the probe
//   fails when a live session is not 404 or a closed one is not 401; the refresh race follows up with the cookies the
//   answers set; a truncated body is never reported as handled; no line holds a cookie or a token.
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { createServer, type Server } from "node:http";
import {
  createServer as netServer,
  type AddressInfo,
  type Server as NetServer,
  type Socket,
} from "node:net";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  measure,
  parseApiMs,
  percentile,
} from "../../scripts/tm-u3-proof/measure.mjs";
import { runRefreshRace } from "../../scripts/tm-u3-proof/refresh-race.mjs";
import { runSessionProbe } from "../../scripts/tm-u3-proof/session-probe.mjs";
import {
  sendTruncatedBody,
  wasNotHandled,
} from "../../scripts/tm-u3-proof/truncated.mjs";

const cli = fileURLToPath(
  new URL("../../scripts/tm-u3-proof/cli.mjs", import.meta.url),
);
const SECRET = "secret-value-that-must-never-be-printed";

describe("percentile and parseApiMs", () => {
  it("uses the nearest rank", () => {
    const values = Array.from({ length: 100 }, (_, index) => index + 1);
    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile([5, 1, 3], 95)).toBe(5);
    expect(percentile([], 50)).toBeNaN();
  });

  it("reads the api span of Server-Timing and nothing else", () => {
    expect(parseApiMs("api;dur=12.5")).toBe(12.5);
    expect(parseApiMs("db;dur=3, api;dur=7")).toBe(7);
    expect(parseApiMs("xapi;dur=7")).toBeUndefined();
    expect(parseApiMs(null)).toBeUndefined();
  });
});

describe("measure (M1)", () => {
  // What the temporary routes send on a 2xx: one span. `api` overrides it per path: a number, null (no header), a raw
  // header string, or a function of the call number. Health and the page never send a span.
  const DEFAULT_SPAN: Record<string, number> = {
    "/api/session": 10,
    "/api/proof/session-cold": 10,
    "/api/proof/read": 10,
  };
  // A clock the fake fetch advances: a call to `path` takes `ms[path]` ms end to end. With `sessionCache`, /api/session
  // behaves like the real cache: a miss (cold, 130 ms at the API) fills an entry that lives 30 s and a hit (20 ms) does
  // not extend it.
  function harness(options: {
    ms?: Record<string, number>;
    api?: Record<
      string,
      number | string | null | ((call: number) => number | undefined)
    >;
    status?: Record<string, number | ((call: number) => number)>;
    body?: Record<string, string>;
    // A Set-Cookie line an answer carries, by call number: the refresh proxy.ts does when the token has expired.
    cookie?: Record<string, (call: number) => string | undefined>;
    sessionCache?: boolean;
    // When the entry that an earlier run left in the cache was filled, in ms relative to the start of this run.
    cacheFilledAt?: number;
  }) {
    let clock = 0;
    let filledAt = options.cacheFilledAt ?? Number.NEGATIVE_INFINITY;
    const calls: Record<string, number> = {};
    const slept: number[] = [];
    const seen: { path: string; cookie: string | null }[] = [];
    const fetchImpl = async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const path = new URL(String(url)).pathname;
      seen.push({
        path,
        cookie: new Headers(init?.headers).get("cookie"),
      });
      calls[path] = (calls[path] ?? 0) + 1;
      // Overlapping calls share the time they wait: a call ends `ms` after it started, whatever else is in flight.
      const start = clock;
      await Promise.resolve();
      clock = Math.max(clock, start + (options.ms?.[path] ?? 10));
      const configured =
        options.api && path in options.api
          ? options.api[path]
          : DEFAULT_SPAN[path];
      let span: number | string | null | undefined =
        typeof configured === "function" ? configured(calls[path]) : configured;
      if (options.sessionCache && path === "/api/session") {
        const hit = start - filledAt <= 30_000;
        if (!hit) filledAt = start;
        span = hit ? 20 : 130;
      }
      const headers = new Headers();
      if (typeof span === "number")
        headers.set("server-timing", `api;dur=${span}`);
      if (typeof span === "string") headers.set("server-timing", span);
      const cookie = options.cookie?.[path]?.(calls[path]);
      if (cookie) headers.append("set-cookie", cookie);
      const status = options.status?.[path] ?? 200;
      return new Response(
        options.body?.[path] ??
          (path === "/api/proof/read" ? '{"ok":true}' : "{}"),
        {
          status: typeof status === "function" ? status(calls[path]) : status,
          headers,
        },
      );
    };
    const sleep = async (ms: number) => {
      slept.push(ms);
      clock += ms;
    };
    return { fetchImpl, now: () => clock, sleep, slept, seen };
  }

  it("takes 100 sequential and 20 concurrent samples of each route, the session route primed first", async () => {
    const { fetchImpl, now, seen } = harness({});
    await measure({
      apiBase: "http://api.test",
      origin: "http://app.test",
      cookie: SECRET,
      fetchImpl: fetchImpl as typeof fetch,
      sleep: async () => {},
      now,
    });
    const count = (path: string) =>
      seen.filter((entry) => entry.path === path).length;
    expect(count("/api/health")).toBe(120);
    expect(count("/api/health/db")).toBe(120);
    expect(count("/api/session")).toBe(121);
    expect(count("/api/proof/session-cold")).toBe(120);
    expect(count("/login")).toBe(120);
    expect(count("/api/proof/read")).toBe(120);
  });

  it("reports p50 and p95 end to end and at the API, with n/a where a route sends no Server-Timing", async () => {
    const { fetchImpl, now } = harness({
      ms: { "/api/proof/read": 100 },
      api: { "/api/proof/read": 40 },
    });
    const { lines } = await measure({
      apiBase: "http://api.test",
      origin: "http://app.test",
      cookie: SECRET,
      fetchImpl: fetchImpl as typeof fetch,
      sleep: async () => {},
      now,
    });
    const read = lines.find((line) =>
      line.includes("MEASURE GET /api/proof/read (two queries) sequential"),
    );
    expect(read).toContain("end to end p50 100 ms, p95 100 ms");
    expect(read).toContain("at the API p50 40 ms, p95 40 ms");
    const health = lines.find((line) =>
      line.includes("MEASURE GET /api/health sequential"),
    );
    expect(health).toContain("at the API n/a");
    // The page makes no API call, so it is the proxy.ts check plus delivery, not getUser() alone, and sends no span.
    const page = lines.find((line) =>
      line.includes(
        "MEASURE GET /login (page with no API call: the proxy.ts check plus delivery) sequential",
      ),
    );
    expect(page).toContain("at the API n/a");
  });

  it("fails when the p95 of the read route is over the budget of TM-U3 to TM-U10, and only informs about the later one", async () => {
    const within = harness({
      ms: { "/api/proof/read": 200 },
      api: { "/api/proof/read": 100 },
    });
    const ok = await measure({
      apiBase: "http://api.test",
      origin: "http://app.test",
      cookie: SECRET,
      fetchImpl: within.fetchImpl as typeof fetch,
      sleep: async () => {},
      now: within.now,
    });
    expect(ok.failed).toBe(0);
    expect(
      ok.lines.some((line) =>
        line.startsWith(
          "PASS BUDGET GET /api/proof/read (two queries) sequential against the after TM-U11",
        ),
      ),
    ).toBe(true);

    const slowApi = harness({
      ms: { "/api/proof/read": 400 },
      api: { "/api/proof/read": 350 },
    });
    const bad = await measure({
      apiBase: "http://api.test",
      origin: "http://app.test",
      cookie: SECRET,
      fetchImpl: slowApi.fetchImpl as typeof fetch,
      sleep: async () => {},
      now: slowApi.now,
    });
    expect(bad.failed).toBeGreaterThan(0);
    expect(
      bad.lines.some((line) =>
        line.startsWith(
          "FAIL BUDGET GET /api/proof/read (two queries) sequential against the TM-U3 to TM-U10",
        ),
      ),
    ).toBe(true);

    const between = harness({
      ms: { "/api/proof/read": 500 },
      api: { "/api/proof/read": 200 },
    });
    const info = await measure({
      apiBase: "http://api.test",
      origin: "http://app.test",
      cookie: SECRET,
      fetchImpl: between.fetchImpl as typeof fetch,
      sleep: async () => {},
      now: between.now,
    });
    expect(info.failed).toBe(0);
    expect(
      info.lines.some((line) =>
        line.startsWith(
          "INFO BUDGET GET /api/proof/read (two queries) sequential against the after TM-U11",
        ),
      ),
    ).toBe(true);
  });

  it("fails when only the end to end p95 is over its budget", async () => {
    const { fetchImpl, now } = harness({
      ms: { "/api/proof/read": 700 },
      api: { "/api/proof/read": 100 },
    });
    const { lines, failed } = await measure({
      apiBase: "http://api.test",
      origin: "http://app.test",
      cookie: SECRET,
      fetchImpl: fetchImpl as typeof fetch,
      sleep: async () => {},
      now,
    });
    expect(failed).toBeGreaterThan(0);
    expect(
      lines.some((line) =>
        line.startsWith(
          "FAIL BUDGET GET /api/proof/read (two queries) sequential against the TM-U3 to TM-U10",
        ),
      ),
    ).toBe(true);
  });

  const opts = (h: ReturnType<typeof harness>) => ({
    apiBase: "http://api.test",
    origin: "http://app.test",
    cookie: SECRET,
    fetchImpl: h.fetchImpl as typeof fetch,
    now: h.now,
    sleep: h.sleep,
  });

  it("prints the added Auth cost per mode as an estimate: the p50 difference of the cold and the warm session route", async () => {
    const { lines, failed } = await measure(
      opts(
        harness({
          api: { "/api/proof/session-cold": 130, "/api/session": 20 },
        }),
      ),
    );
    expect(failed).toBe(0);
    for (const mode of ["sequential", "concurrent"]) {
      const line = lines.find((item) =>
        item.startsWith(`INFO AUTH COST ESTIMATE ${mode}:`),
      );
      expect(line).toContain("without the cache p50 130 ms");
      expect(line).toContain("with the cache p50 20 ms");
      expect(line).toContain(
        "estimated added Auth cost (p50 difference, not a directly timed /auth/v1/user round trip) 110 ms",
      );
    }
  });

  it("fails a session route that sends no span, and prints no estimate for it", async () => {
    const { lines, failed } = await measure(
      opts(harness({ api: { "/api/proof/session-cold": null } })),
    );
    expect(failed).toBe(2);
    expect(
      lines.filter(
        (item) =>
          item.startsWith("FAIL MEASURE GET /api/proof/session-cold") &&
          item.includes("without exactly one Server-Timing span"),
      ),
    ).toHaveLength(2);
    const estimates = lines.filter((item) =>
      item.includes("AUTH COST ESTIMATE"),
    );
    expect(estimates).toHaveLength(2);
    for (const line of estimates) {
      expect(line).toContain("n/a");
      expect(line).not.toMatch(/\d+ ms/);
    }
  });

  it("fails when /api/proof/read answers 200 with ok:false, the shorter path, and gives that batch no budget verdict", async () => {
    const { lines, failed } = await measure(
      opts(harness({ body: { "/api/proof/read": '{"ok":false}' } })),
    );
    expect(failed).toBe(2);
    expect(
      lines.filter(
        (item) =>
          item.startsWith("FAIL MEASURE GET /api/proof/read") &&
          item.includes("ok=0"),
      ),
    ).toHaveLength(2);
    expect(lines.some((item) => item.includes("BUDGET"))).toBe(false);
  });

  it("fails a batch that lost some of its spans, so one span cannot stand for n=100", async () => {
    const { lines, failed } = await measure(
      opts(
        harness({
          api: { "/api/proof/read": (call) => (call === 5 ? undefined : 40) },
        }),
      ),
    );
    expect(failed).toBe(1);
    expect(
      lines.find((item) => item.startsWith("FAIL MEASURE GET /api/proof/read")),
    ).toContain("1 without exactly one Server-Timing span");
  });

  it("fails a sample that carries two api spans", async () => {
    const { failed } = await measure(
      opts(
        harness({
          api: { "/api/proof/read": "api;dur=10, api;dur=20" },
        }),
      ),
    );
    expect(failed).toBe(2);
  });

  it("keeps the warm session samples warm over a long sequential phase: it waits for the 30 s entry to expire, refills it unsampled and goes on", async () => {
    const h = harness({
      ms: { "/api/session": 1000 },
      sessionCache: true,
    });
    const { lines, failed } = await measure(opts(h));
    expect(failed).toBe(0);
    const warm = lines.find((item) =>
      item.includes("MEASURE GET /api/session (warm cache) sequential"),
    );
    expect(warm).toContain("at the API p50 20 ms, p95 20 ms");
    expect(h.slept.length).toBeGreaterThan(0);
    // Waiting out the entry is what makes the refill a miss; a refill while it is alive would be a hit.
    expect(Math.min(...h.slept)).toBeGreaterThan(0);
  });

  it("waits for an entry left by an earlier run to expire before the first prime, so the warm samples stay warm", async () => {
    // An earlier run left an entry that is nearly expired when the first prime comes.
    const h = harness({
      ms: { "/api/session": 1000 },
      sessionCache: true,
      // The two health batches before it take 220 ms, so the entry (30 s) ends at 300 ms: the prime at 220 ms is a hit
      // on an entry that dies before the first sample. Ten samples make the p95 the slowest one.
      cacheFilledAt: -29_700,
    });
    const { lines, failed } = await measure({
      ...opts(h),
      sequential: 10,
      concurrent: 2,
    });
    expect(failed).toBe(0);
    expect(h.slept.length).toBeGreaterThan(0);
    expect(
      lines.find((item) =>
        item.includes("MEASURE GET /api/session (warm cache) sequential"),
      ),
    ).toContain("at the API p50 20 ms, p95 20 ms");
  });

  it("fails the batch when a priming call is not a valid 2xx with one span", async () => {
    const refused = await measure(
      opts(
        harness({
          status: { "/api/session": (call) => (call === 1 ? 500 : 200) },
        }),
      ),
    );
    expect(refused.failed).toBe(1);
    expect(
      refused.lines.find((item) =>
        item.startsWith("FAIL MEASURE GET /api/session"),
      ),
    ).toContain("1 priming call(s) failed");
    const spanless = await measure(
      opts(
        harness({
          api: { "/api/session": (call) => (call === 1 ? undefined : 10) },
        }),
      ),
    );
    expect(spanless.failed).toBe(1);
    expect(
      spanless.lines.find((item) =>
        item.startsWith("FAIL MEASURE GET /api/session"),
      ),
    ).toContain("priming call(s) failed");
  });

  it("fails a batch whose answer replaced the session cookie, on every target, and tells the Owner to sign in again", async () => {
    for (const path of ["/api/health", "/api/proof/read", "/login"]) {
      const { lines, failed } = await measure(
        opts(
          harness({
            cookie: {
              [path]: (call) =>
                call === 30 ? "sb-p-auth-token.0=renewed; Path=/" : undefined,
            },
          }),
        ),
      );
      expect(failed, path).toBe(1);
      const line = lines.find((item) => item.startsWith("FAIL MEASURE"));
      expect(line, path).toContain(path);
      expect(line, path).toContain("sign in again and rerun");
    }
  });

  it("does not fail a batch over a cookie that is not the session cookie", async () => {
    const { failed } = await measure(
      opts(harness({ cookie: { "/api/health": () => "prefs=1; Path=/" } })),
    );
    expect(failed).toBe(0);
  });

  it("fails a route that does not answer 2xx, and prints no cookie", async () => {
    const { fetchImpl, now, seen } = harness({
      status: { "/api/health/db": 503 },
    });
    const { lines, failed } = await measure({
      apiBase: "http://api.test",
      origin: "http://app.test",
      cookie: SECRET,
      fetchImpl: fetchImpl as typeof fetch,
      sleep: async () => {},
      now,
    });
    expect(failed).toBeGreaterThan(0);
    expect(
      lines.some((line) => /^FAIL MEASURE GET \/api\/health\/db/.test(line)),
    ).toBe(true);
    expect(lines.join("\n")).not.toContain(SECRET);
    // The cookie goes with the requests and with nothing else.
    expect(seen.every((entry) => entry.cookie === SECRET)).toBe(true);
  });
});

describe("runSessionProbe (M2)", () => {
  const tokens = { A: `${SECRET}-a`, B: `${SECRET}-b` };
  function fake(status: (path: string, token: string) => number) {
    const seen: string[] = [];
    const fetchImpl = async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const path = new URL(String(url)).pathname;
      const token = (
        new Headers(init?.headers).get("authorization") ?? ""
      ).replace("Bearer ", "");
      seen.push(
        `${path} ${token === tokens.A ? "A" : token === tokens.B ? "B" : "?"}`,
      );
      // The real 404 of the proof owner check and the 401 of the session guard carry no Server-Timing header.
      return new Response("{}", { status: status(path, token) });
    };
    return { fetchImpl: fetchImpl as typeof fetch, seen };
  }

  it("live: passes when both sessions are refused 404 by the proof owner check, with one request each and no timing line", async () => {
    const { fetchImpl, seen } = fake(() => 404);
    const { lines, failed } = await runSessionProbe({
      apiBase: "http://api.test",
      step: "live",
      tokens,
      fetchImpl,
    });
    expect(failed).toBe(0);
    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.startsWith("PASS"))).toBe(true);
    expect(lines.join("\n")).not.toMatch(/ms|Server-Timing/);
    expect(seen).toEqual([
      "/api/proof/session-cold A",
      "/api/proof/session-cold B",
    ]);
  });

  it("live: a session that is already refused 401 fails, so a later 401 would prove nothing", async () => {
    const { fetchImpl } = fake((path, token) =>
      token === tokens.B && path === "/api/proof/session-cold" ? 401 : 404,
    );
    const { lines, failed } = await runSessionProbe({
      apiBase: "http://api.test",
      step: "live",
      tokens,
      fetchImpl,
    });
    expect(failed).toBe(1);
    expect(lines.find((line) => line.startsWith("FAIL"))).toContain(
      "session B",
    );
  });

  it("after: passes on 401 for both and fails when a session is still accepted", async () => {
    const closed = fake(() => 401);
    const ok = await runSessionProbe({
      apiBase: "http://api.test",
      step: "after",
      tokens,
      fetchImpl: closed.fetchImpl,
    });
    expect(ok.failed).toBe(0);
    expect(closed.seen).toEqual([
      "/api/proof/session-cold A",
      "/api/proof/session-cold B",
    ]);

    const stillLive = fake((_path, token) => (token === tokens.A ? 404 : 401));
    const bad = await runSessionProbe({
      apiBase: "http://api.test",
      step: "after",
      tokens,
      fetchImpl: stillLive.fetchImpl,
    });
    expect(bad.failed).toBe(1);
    expect(bad.lines.find((line) => line.startsWith("FAIL"))).toContain(
      "session A",
    );
    expect(bad.lines.join("\n")).not.toContain(SECRET);
  });
});

describe("runRefreshRace (T5)", () => {
  const origin = "http://app.test";
  function fake(options: { refresh: (header: string) => string[] | null }) {
    const sent: string[] = [];
    const fetchImpl = async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const header = new Headers(init?.headers).get("cookie") ?? "";
      sent.push(header);
      const set = options.refresh(header);
      if (set === null) return new Response(null, { status: 401 });
      const headers = new Headers();
      for (const line of set) headers.append("set-cookie", line);
      return new Response("{}", { status: 200, headers });
    };
    return { fetchImpl: fetchImpl as typeof fetch, sent };
  }

  it("sends 20 requests with the expired cookie, then one with the cookies the answers set", async () => {
    const { fetchImpl, sent } = fake({
      refresh: (header) =>
        header.includes("sb-p-auth-token=expired")
          ? ["sb-p-auth-token=fresh; Path=/; HttpOnly", "refresh=next; Path=/"]
          : [],
    });
    const { lines, failed } = await runRefreshRace({
      origin,
      cookie: "sb-p-auth-token=expired; refresh=old",
      fetchImpl,
    });
    expect(failed).toBe(0);
    expect(sent).toHaveLength(21);
    expect(
      sent
        .slice(0, 20)
        .every((header) => header === "sb-p-auth-token=expired; refresh=old"),
    ).toBe(true);
    expect(sent[20]).toBe("sb-p-auth-token=fresh; refresh=next");
    expect(lines.join("\n")).toContain(
      "20 of 20 answers replaced a session cookie",
    );
  });

  it("fails when the follow-up is refused: the refresh race left the session unusable", async () => {
    const { fetchImpl } = fake({
      refresh: (header) =>
        header === "sb-p-auth-token=expired; refresh=old"
          ? ["sb-p-auth-token=burnt; Path=/"]
          : null,
    });
    const { lines, failed } = await runRefreshRace({
      origin,
      cookie: "sb-p-auth-token=expired; refresh=old",
      fetchImpl,
    });
    expect(failed).toBe(1);
    expect(lines.find((line) => line.startsWith("FAIL"))).toContain(
      "still usable",
    );
  });

  it("fails when any of the parallel requests is not 200", async () => {
    let calls = 0;
    const fetchImpl = (async () =>
      new Response("{}", {
        status: ++calls === 7 ? 401 : 200,
        headers: { "set-cookie": "sb-p-auth-token=fresh; Path=/" },
      })) as typeof fetch;
    const { failed, lines } = await runRefreshRace({
      origin,
      cookie: `sb-p-auth-token=${SECRET}`,
      fetchImpl,
    });
    expect(failed).toBe(1);
    expect(lines.find((line) => line.startsWith("FAIL"))).toContain("401 x1");
    expect(lines.join("\n")).not.toContain(SECRET);
  });

  it("fails when every answer is 200 and none replaced a cookie: no refresh ran, so nothing was shown", async () => {
    const { fetchImpl } = fake({ refresh: () => [] });
    const { lines, failed } = await runRefreshRace({
      origin,
      cookie: "sb-p-auth-token=expired; refresh=old",
      fetchImpl,
    });
    expect(failed).toBe(1);
    expect(lines.find((line) => line.startsWith("FAIL"))).toContain(
      "replaced a session cookie",
    );
  });

  it("does not count a Set-Cookie that only deletes a cookie as a refresh", async () => {
    const { fetchImpl } = fake({
      refresh: () => [
        "sb-p-auth-token=; Path=/",
        "refresh=x; Path=/; Max-Age=0",
      ],
    });
    const { failed } = await runRefreshRace({
      origin,
      cookie: "sb-p-auth-token=expired; refresh=old",
      fetchImpl,
    });
    expect(failed).toBe(1);
  });

  it("applies the cookies in the order the answers arrive, not the order the requests were launched", async () => {
    const sent: string[] = [];
    let launched = 0;
    const fetchImpl = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      sent.push(new Headers(init?.headers).get("cookie") ?? "");
      const call = ++launched;
      if (call > 20) return new Response("{}", { status: 200 });
      // Request 1 answers last, request 20 first.
      await new Promise((resolve) => setTimeout(resolve, (21 - call) * 5));
      return new Response("{}", {
        status: 200,
        headers: { "set-cookie": `sb-p-auth-token=fresh-${call}; Path=/` },
      });
    }) as typeof fetch;
    const { failed } = await runRefreshRace({
      origin,
      cookie: "sb-p-auth-token=expired; refresh=old",
      fetchImpl,
    });
    expect(failed).toBe(0);
    expect(sent[20]).toBe("sb-p-auth-token=fresh-1; refresh=old");
  });

  it("counts a chunk of the session cookie as a refresh, and a cookie that is not the session as none", async () => {
    const chunk = fake({ refresh: () => ["sb-p-auth-token.1=part; Path=/"] });
    const ok = await runRefreshRace({
      origin,
      cookie: "sb-p-auth-token=expired",
      fetchImpl: chunk.fetchImpl,
    });
    expect(ok.failed).toBe(0);
    const unrelated = fake({ refresh: () => ["prefs=1; Path=/"] });
    const bad = await runRefreshRace({
      origin,
      cookie: "sb-p-auth-token=expired",
      fetchImpl: unrelated.fetchImpl,
    });
    expect(bad.failed).toBe(1);
    expect(bad.lines.find((line) => line.startsWith("FAIL"))).toContain(
      "replaced a session cookie",
    );
  });

  it("applies the cookies when the headers arrive, before the body: reversed header and body order", async () => {
    const sent: string[] = [];
    let launched = 0;
    const fetchImpl = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      sent.push(new Headers(init?.headers).get("cookie") ?? "");
      const call = ++launched;
      if (call > 20) return new Response("{}", { status: 200 });
      // The headers of request n arrive after those of n - 1, but the bodies arrive in the opposite order.
      await new Promise((resolve) => setTimeout(resolve, call));
      const body = new ReadableStream({
        async start(controller) {
          await new Promise((resolve) => setTimeout(resolve, (21 - call) * 5));
          controller.enqueue(new TextEncoder().encode("{}"));
          controller.close();
        },
      });
      return new Response(body, {
        status: 200,
        headers: { "set-cookie": `sb-p-auth-token=fresh-${call}; Path=/` },
      });
    }) as typeof fetch;
    const { failed } = await runRefreshRace({
      origin,
      cookie: "sb-p-auth-token=expired; refresh=old",
      fetchImpl,
    });
    expect(failed).toBe(0);
    expect(sent[20]).toBe("sb-p-auth-token=fresh-20; refresh=old");
  });

  it("drops a cookie the answers empty or expire", async () => {
    const { fetchImpl, sent } = fake({
      refresh: (header) =>
        header.includes("old=1")
          ? ["old=; Path=/", "next=2; Path=/; Max-Age=0", "keep=3"]
          : [],
    });
    await runRefreshRace({ origin, cookie: "old=1; next=1", fetchImpl });
    expect(sent.at(-1)).toBe("keep=3");
  });
});

describe("sendTruncatedBody (T3)", () => {
  const servers: (Server | NetServer)[] = [];
  const held: Socket[] = [];
  afterEach(async () => {
    for (const socket of held.splice(0)) socket.destroy();
    await Promise.all(
      servers.splice(0).map((server) => {
        if ("closeAllConnections" in server) server.closeAllConnections();
        return new Promise((resolve) => server.close(resolve));
      }),
    );
  });

  // A server that counts a request as handled only once its whole body arrived, as the API's body reader does.
  async function serve(handlesPartial = false) {
    const state = { handled: 0, sawCookie: false };
    const server = createServer((request, response) => {
      state.sawCookie ||= request.headers.cookie === SECRET;
      const finish = () => {
        state.handled += 1;
        response.statusCode = 200;
        response.end("{}");
      };
      if (handlesPartial) {
        request.resume();
        finish();
        return;
      }
      request.on("end", finish);
      request.resume();
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    return {
      base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      state,
    };
  }

  it("is never handled by a server that waits for the declared length, and says how the exchange ended", async () => {
    const { base, state } = await serve();
    const outcome = await sendTruncatedBody({
      base,
      path: "/echo",
      cookie: SECRET,
      origin: base,
      declared: 4096,
      sent: 512,
    });
    expect(state.handled).toBe(0);
    expect(state.sawCookie).toBe(true);
    expect(outcome.status === null || outcome.status >= 400).toBe(true);
    expect(["closed", "answered", "reset"]).toContain(outcome.ended);
  });

  it("reports a 2xx from a server that handles the partial body, so the run can fail it", async () => {
    const { base } = await serve(true);
    const outcome = await sendTruncatedBody({
      base,
      path: "/echo",
      cookie: SECRET,
      origin: base,
    });
    expect(outcome.status).toBe(200);
  });

  it("gives up after the timeout when the server neither answers nor closes", async () => {
    // A bare TCP server: Node's HTTP server would answer 400 to the half-closed request.
    const server = netServer({ allowHalfOpen: true }, (socket) => {
      held.push(socket);
      socket.on("error", () => {});
      socket.resume();
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const outcome = await sendTruncatedBody({
      base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      path: "/echo",
      cookie: SECRET,
      origin: "http://app.test",
      timeoutMs: 300,
    });
    expect(outcome).toEqual({ status: null, ended: "timeout" });
  });

  it("says not-sent when the connection fails before the request is written, and that is not a refusal", async () => {
    const probe = netServer();
    await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = (probe.address() as AddressInfo).port;
    await new Promise((resolve) => probe.close(resolve));
    const outcome = await sendTruncatedBody({
      base: `http://127.0.0.1:${port}`,
      path: "/echo",
      cookie: SECRET,
      origin: "http://app.test",
    });
    expect(outcome).toEqual({ status: null, ended: "not-sent" });
    expect(wasNotHandled(outcome)).toBe(false);
  });

  // A socket that connects and then fails the way the test says; no network is involved.
  function fakeSocket(behaviour: {
    writeError?: boolean;
    answerFirst?: string;
  }) {
    const socket = new EventEmitter() as EventEmitter & {
      write: (data: unknown, callback?: (error?: Error) => void) => boolean;
      end: () => void;
      destroy: () => void;
    };
    let writes = 0;
    socket.write = (_data, callback) => {
      writes += 1;
      // The head is queued at once; the body write is the last one and decides the outcome.
      if (writes === 2) {
        queueMicrotask(() => {
          if (behaviour.answerFirst)
            socket.emit("data", Buffer.from(behaviour.answerFirst));
          if (behaviour.writeError) {
            const error = new Error("EPIPE");
            callback?.(error);
            socket.emit("error", error);
          } else {
            callback?.();
            socket.emit("error", new Error("ECONNRESET"));
          }
        });
      }
      return true;
    };
    socket.end = () => {};
    socket.destroy = () => {};
    queueMicrotask(() => socket.emit("connect"));
    return socket;
  }

  it("keeps an error before the request was flushed as not-sent, with no status read", async () => {
    const outcome = await sendTruncatedBody({
      base: "http://127.0.0.1:1",
      path: "/echo",
      cookie: SECRET,
      origin: "http://app.test",
      connect: () => fakeSocket({ writeError: true }) as never,
    });
    expect(outcome).toEqual({ status: null, ended: "not-sent" });
    expect(wasNotHandled(outcome)).toBe(false);
  });

  it("counts an error after the request was flushed as a refusal, and an error after a status line was read too", async () => {
    const flushed = await sendTruncatedBody({
      base: "http://127.0.0.1:1",
      path: "/echo",
      cookie: SECRET,
      origin: "http://app.test",
      connect: () => fakeSocket({}) as never,
    });
    expect(flushed).toEqual({ status: null, ended: "reset" });
    expect(wasNotHandled(flushed)).toBe(true);
    const answered = await sendTruncatedBody({
      base: "http://127.0.0.1:1",
      path: "/echo",
      cookie: SECRET,
      origin: "http://app.test",
      connect: () =>
        fakeSocket({
          writeError: true,
          answerFirst: "HTTP/1.1 413 Too Large\r\n\r\n",
        }) as never,
    });
    expect(answered).toEqual({ status: 413, ended: "reset" });
    expect(wasNotHandled(answered)).toBe(true);
  });

  it("counts a connection the server resets after the request was written as a refusal", async () => {
    const server = netServer((socket) => {
      socket.on("error", () => {});
      socket.on("data", () => socket.destroy());
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const outcome = await sendTruncatedBody({
      base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      path: "/echo",
      cookie: SECRET,
      origin: "http://app.test",
    });
    expect(["reset", "closed"]).toContain(outcome.ended);
    expect(wasNotHandled(outcome)).toBe(true);
  });

  it.each([
    [{ status: null, ended: "closed" }, true],
    // Only after the request was written: a failure before that is "not-sent".
    [{ status: null, ended: "reset" }, true],
    [{ status: null, ended: "not-sent" }, false],
    [{ status: 400, ended: "answered" }, true],
    [{ status: 413, ended: "answered" }, true],
    [{ status: 502, ended: "answered" }, true],
    [{ status: 200, ended: "answered" }, false],
    [{ status: 204, ended: "answered" }, false],
    [{ status: 302, ended: "answered" }, false],
    [{ status: null, ended: "timeout" }, false],
  ])("wasNotHandled(%j) is %s", (outcome, expected) => {
    expect(wasNotHandled(outcome)).toBe(expected);
  });

  it("refuses a header value with a line break", () => {
    expect(() =>
      sendTruncatedBody({
        base: "http://127.0.0.1:1",
        path: "/echo",
        cookie: "a=b\r\nx-injected: 1",
        origin: "http://app.test",
      }),
    ).toThrow(/line break/);
  });
});

describe("the new commands", () => {
  const run = (env: Record<string, string | undefined>, ...args: string[]) =>
    new Promise<{ status: number | null; stdout: string; stderr: string }>(
      (resolve) => {
        const child = spawn(process.execPath, [cli, ...args], {
          env: {
            ...process.env,
            PROOF_COOKIE: undefined,
            PROOF_TOKEN_A: undefined,
            PROOF_TOKEN_B: undefined,
            ...env,
          },
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => (stdout += chunk));
        child.stderr.on("data", (chunk) => (stderr += chunk));
        child.on("close", (status) => resolve({ status, stdout, stderr }));
      },
    );

  it.each([
    [
      [
        "measure",
        "--api",
        "http://127.0.0.1:1",
        "--origin",
        "http://127.0.0.1:1",
      ],
      "PROOF_COOKIE",
    ],
    [["measure", "--api", "http://127.0.0.1:1"], "PROOF_COOKIE"],
    [["refresh-race", "--origin", "http://127.0.0.1:1"], "PROOF_COOKIE"],
    [
      ["session-probe", "--api", "http://127.0.0.1:1", "--step", "live"],
      "PROOF_TOKEN_A",
    ],
    [
      ["session-probe", "--api", "http://127.0.0.1:1", "--step", "later"],
      "--step",
    ],
  ])(
    "%j exits 2 before asking anything, naming what is missing",
    async (args, missing) => {
      const result = await run({}, ...args);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain(missing);
      expect(result.stdout).toBe("");
    },
  );

  it("measure and refresh-race need the app origin, refresh-race needs no API address", async () => {
    const result = await run(
      { PROOF_COOKIE: SECRET },
      "measure",
      "--api",
      "http://127.0.0.1:1",
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--origin");
    expect(result.stderr).not.toContain(SECRET);
    const race = await run({ PROOF_COOKIE: SECRET }, "refresh-race");
    expect(race.status).toBe(2);
    expect(race.stderr).toContain("--origin");
  });

  it("the probe prints status lines only, never a token", async () => {
    const server = createServer((_request, response) => {
      response.statusCode = 404;
      response.end();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const api = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const result = await run(
        { PROOF_TOKEN_A: `${SECRET}-a`, PROOF_TOKEN_B: `${SECRET}-b` },
        "session-probe",
        "--api",
        api,
        "--step",
        "after",
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("FAIL session A");
      expect(result.stdout + result.stderr).not.toContain(SECRET);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
