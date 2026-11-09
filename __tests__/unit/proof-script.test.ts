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
  // A clock the fake fetch advances: a call to `path` takes `ms[path]` ms end to end.
  function harness(options: {
    ms?: Record<string, number>;
    api?: Record<string, number>;
    status?: Record<string, number>;
  }) {
    let clock = 0;
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
      // Overlapping calls share the time they wait: a call ends `ms` after it started, whatever else is in flight.
      const start = clock;
      await Promise.resolve();
      clock = Math.max(clock, start + (options.ms?.[path] ?? 10));
      const headers = new Headers();
      if (options.api?.[path] !== undefined)
        headers.set("server-timing", `api;dur=${options.api[path]}`);
      return new Response("{}", {
        status: options.status?.[path] ?? 200,
        headers,
      });
    };
    return { fetchImpl, now: () => clock, seen };
  }

  it("takes 100 sequential and 20 concurrent samples of each route, the session route primed first", async () => {
    const { fetchImpl, now, seen } = harness({});
    await measure({
      apiBase: "http://api.test",
      origin: "http://app.test",
      cookie: SECRET,
      fetchImpl: fetchImpl as typeof fetch,
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

  it("fails a route that does not answer 2xx, and prints no cookie", async () => {
    const { fetchImpl, now, seen } = harness({
      status: { "/api/health/db": 503 },
    });
    const { lines, failed } = await measure({
      apiBase: "http://api.test",
      origin: "http://app.test",
      cookie: SECRET,
      fetchImpl: fetchImpl as typeof fetch,
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
      return new Response("{}", {
        status: status(path, token),
        headers: { "server-timing": "api;dur=20" },
      });
    };
    return { fetchImpl: fetchImpl as typeof fetch, seen };
  }

  it("live: passes when both sessions are refused 404 by the proof owner check, and reports the Auth round trip both ways", async () => {
    const { fetchImpl } = fake((path) => (path === "/api/session" ? 200 : 404));
    const { lines, failed } = await runSessionProbe({
      apiBase: "http://api.test",
      step: "live",
      tokens,
      samples: 3,
      fetchImpl,
    });
    expect(failed).toBe(0);
    expect(lines.filter((line) => line.startsWith("PASS"))).toHaveLength(2);
    expect(
      lines.filter((line) => line.includes("without the cache")),
    ).toHaveLength(2);
    expect(lines.join("\n")).toContain("with the cache: p50 20 ms");
  });

  it("live: a session that is already refused 401 fails, so a later 401 would prove nothing", async () => {
    const { fetchImpl } = fake((path, token) =>
      token === tokens.B && path === "/api/proof/session-cold" ? 401 : 404,
    );
    const { lines, failed } = await runSessionProbe({
      apiBase: "http://api.test",
      step: "live",
      tokens,
      samples: 1,
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
        header.includes("access=expired")
          ? ["access=fresh; Path=/; HttpOnly", "refresh=next; Path=/"]
          : [],
    });
    const { lines, failed } = await runRefreshRace({
      origin,
      cookie: "access=expired; refresh=old",
      fetchImpl,
    });
    expect(failed).toBe(0);
    expect(sent).toHaveLength(21);
    expect(
      sent
        .slice(0, 20)
        .every((header) => header === "access=expired; refresh=old"),
    ).toBe(true);
    expect(sent[20]).toBe("access=fresh; refresh=next");
    expect(lines.join("\n")).toContain("20 of 20 answers set cookies");
  });

  it("fails when the follow-up is refused: the refresh race left the session unusable", async () => {
    const { fetchImpl } = fake({
      refresh: (header) =>
        header === "access=expired; refresh=old"
          ? ["refresh=burnt; Path=/"]
          : null,
    });
    const { lines, failed } = await runRefreshRace({
      origin,
      cookie: "access=expired; refresh=old",
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
      })) as typeof fetch;
    const { failed, lines } = await runRefreshRace({
      origin,
      cookie: `a=${SECRET}`,
      fetchImpl,
    });
    expect(failed).toBe(1);
    expect(lines.find((line) => line.startsWith("FAIL"))).toContain("401 x1");
    expect(lines.join("\n")).not.toContain(SECRET);
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

  it.each([
    [{ status: null, ended: "closed" }, true],
    [{ status: null, ended: "reset" }, true],
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
