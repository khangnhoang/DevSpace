// Test plan
// Goal: the session diagnostics of the e2e rows say what is needed to name a lost session, and nothing that is a secret (QE-P7, G4).
// Layer: unit (pure functions and a fake Auth client; no browser, no network).
// Subject: __tests__/helpers/e2e-session.ts and the Auth record of __tests__/e2e/server-auth-record.cjs.
// Allowed paths: the cookie formats of @supabase/ssr decode to ages and lifetimes; a recognised token reads as recognised.
// Denied paths: a rejected token reads as not recognised, with its status and code; an unreadable cookie gives null facts.
// Known bugs: none.
// Invariants: no token, refresh token or cookie value appears in any fact, and the token check holds no refresh token.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  accessTokenOf,
  checkAccessToken,
  describeSession,
  isRefreshRequest,
} from "../helpers/e2e-session";

const b64 = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (claims: Record<string, unknown>) =>
  `${b64({ alg: "HS256" })}.${b64(claims)}.signature-secret`;
const NOW = 1_800_000_000;
const ACCESS = jwt({ iat: NOW - 600, exp: NOW + 3000 });
const REFRESH = "refresh-token-secret";
const session = JSON.stringify({
  access_token: ACCESS,
  refresh_token: REFRESH,
  expires_at: NOW + 3000,
});

describe("describeSession", () => {
  it("reads age, lifetime and remaining lifetime from the claims of a base64 cookie", () => {
    const cookies = [
      {
        name: "sb-127-auth-token",
        value: `base64-${Buffer.from(session).toString("base64url")}`,
      },
    ];
    expect(describeSession(cookies, NOW)).toEqual({
      cookieNames: ["sb-127-auth-token"],
      issuedAt: NOW - 600,
      expiresAt: NOW + 3000,
      lifetimeSeconds: 3600,
      ageSeconds: 600,
      remainingSeconds: 3000,
    });
  });

  it("joins chunked cookies in index order and reads a percent-encoded JSON cookie", () => {
    const encoded = encodeURIComponent(session);
    const half = Math.floor(encoded.length / 2);
    const cookies = [
      { name: "sb-127-auth-token.1", value: encoded.slice(half) },
      { name: "sb-127-auth-token.0", value: encoded.slice(0, half) },
      { name: "unrelated", value: "x" },
    ];
    const facts = describeSession(cookies, NOW);
    expect(facts.cookieNames.sort()).toEqual([
      "sb-127-auth-token.0",
      "sb-127-auth-token.1",
    ]);
    expect(facts.remainingSeconds).toBe(3000);
  });

  it("reports null facts for a cookie that holds no readable token, and an expired token as negative", () => {
    expect(
      describeSession(
        [{ name: "sb-127-auth-token", value: "base64-@@@" }],
        NOW,
      ),
    ).toMatchObject({ issuedAt: null, remainingSeconds: null });
    const expired = JSON.stringify({
      access_token: jwt({ iat: NOW - 4000, exp: NOW - 400 }),
    });
    expect(
      describeSession(
        [
          {
            name: "sb-127-auth-token",
            value: `base64-${Buffer.from(expired).toString("base64url")}`,
          },
        ],
        NOW,
      ).remainingSeconds,
    ).toBe(-400);
  });

  it("never puts a token, a refresh token or a cookie value into the facts", () => {
    const value = `base64-${Buffer.from(session).toString("base64url")}`;
    const text = JSON.stringify(
      describeSession([{ name: "sb-127-auth-token", value }], NOW),
    );
    for (const secret of [ACCESS, REFRESH, value, "signature-secret"])
      expect(text).not.toContain(secret);
    expect(accessTokenOf([{ name: "sb-127-auth-token", value }])).toBe(ACCESS);
  });
});

describe("checkAccessToken", () => {
  it("reads a token Auth accepts as recognised, and one it rejects with the status and code", async () => {
    const accepting = { auth: { getUser: async () => ({ error: null }) } };
    const rejecting = {
      auth: {
        getUser: async () => ({
          error: { status: 403, code: "session_not_found" },
        }),
      },
    };
    expect(await checkAccessToken(accepting, ACCESS)).toEqual({
      recognised: true,
      status: 200,
      code: null,
    });
    expect(await checkAccessToken(rejecting, ACCESS)).toEqual({
      recognised: false,
      status: 403,
      code: "session_not_found",
    });
  });

  it("asks Auth about the access token it was given and never touches a refresh path", async () => {
    const asked: string[] = [];
    await checkAccessToken(
      {
        auth: {
          getUser: async (token: string) => {
            asked.push(token);
            return { error: null };
          },
        },
      },
      ACCESS,
    );
    expect(asked).toEqual([ACCESS]);
  });
});

describe("isRefreshRequest", () => {
  it.each([
    ["http://127.0.0.1:55321/auth/v1/token?grant_type=refresh_token", true],
    ["http://127.0.0.1:55321/auth/v1/token?grant_type=password", false],
    ["http://127.0.0.1:55321/auth/v1/user", false],
    ["not a url", false],
  ])("%s -> %s", (url, expected) => {
    expect(isRefreshRequest(url)).toBe(expected);
  });
});

const root = fileURLToPath(new URL("../..", import.meta.url));
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("the server Auth record", () => {
  it("records the refresh and the token check with their status, a failure as error, and nothing else", () => {
    const dir = mkdtempSync(join(tmpdir(), "e2e-auth-record-"));
    dirs.push(dir);
    const file = join(dir, "auth.jsonl");
    writeFileSync(file, "");
    const script = `
      const http = require("node:http");
      const server = http.createServer((req, res) => {
        res.statusCode = req.url.startsWith("/auth/v1/token") ? 400 : req.url.startsWith("/auth/v1/user") ? 200 : 204;
        res.end("{}");
      });
      server.listen(0, "127.0.0.1", async () => {
        const base = "http://127.0.0.1:" + server.address().port;
        await fetch(base + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { authorization: "Bearer secret-header" }, body: "refresh_token=secret-body" });
        await fetch(base + "/auth/v1/user", { headers: { authorization: "Bearer secret-header" } });
        await fetch(base + "/auth/v1/token?grant_type=password", { method: "POST" });
        await fetch(base + "/rest/v1/courses?select=secret-query");
        await fetch("http://127.0.0.1:1/auth/v1/user").catch(() => {});
        server.close();
      });`;
    const result = spawnSync(
      process.execPath,
      [
        "--require",
        join(root, "__tests__", "e2e", "server-guard.cjs"),
        "-e",
        script,
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          E2E_GUARD_FILE: join(dir, "guard.jsonl"),
          E2E_AUTH_FILE: file,
        },
        encoding: "utf8",
        timeout: 30_000,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    const text = readFileSync(file, "utf8");
    const records = text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(records.map(({ kind, status }) => [kind, status])).toEqual([
      ["refresh", 400],
      ["user", 200],
      ["user", "error"],
    ]);
    for (const secret of ["secret-header", "secret-body", "secret-query"])
      expect(text).not.toContain(secret);
  });
});
