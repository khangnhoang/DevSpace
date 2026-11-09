// Test plan
// Goal: a body that fails a schema of lib/schemas is 400 with a generic message (AC8), and the limits of Owner
//   decision 20 hold: 4 MiB of JSON, one 2 MiB file, a body that matches its Content-Length, and 60 seconds for a
//   handler (AC9).
// Layer: api (the built API with the test-only routes as a process on the test stack, under the network guard).
// Subject: AC8, AC9 of the TM-U3 plan.
// Data: one fixture user for the session the routes require. The 60-second limit is not waited for: the test-only
//   entry point (backend/e2e/main.ts) can shorten it, `src/` cannot, and a row pins the production value.
// Invariants: a refused request never reaches the handler (read from the handler counter); no refusal echoes the body
//   or a schema issue.
import { createConnection } from "node:net";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { afterAllCleanup } from "../helpers/api-timeout-note";
import { readServerEnv } from "../../backend/src/common/env";
import { apiTestEnv, startApi, type RunningApi } from "../helpers/api-process";
import {
  apiSessions,
  bearer,
  type MintedSession,
} from "../helpers/api-session";

const stack = inject("apiStack");
const MIB = 1024 * 1024;

const sessions = apiSessions(stack);
let api: RunningApi;
let short: RunningApi;
let user: MintedSession;

beforeAll(async () => {
  api = await startApi(apiTestEnv(stack), { fixtures: true });
  short = await startApi(
    apiTestEnv(stack, { E2E_REQUEST_TIMEOUT_MS: "1000" }),
    { fixtures: true },
  );
  user = await sessions.mint("validation");
});

afterAll(
  afterAllCleanup("validation", () => [
    () => sessions.cleanup(),
    () => api?.stop(),
    () => short?.stop(),
  ]),
);

async function handled(target = api): Promise<number> {
  const response = await fetch(`${target.url}/api/e2e/handled`, {
    headers: bearer(user),
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { handled: number }).handled;
}

function postJson(path: string, body: string, target = api) {
  return fetch(`${target.url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...bearer(user) },
    body,
  });
}

const GENERIC = {
  message: "Dữ liệu không hợp lệ.",
  error: "Bad Request",
  statusCode: 400,
};

const valid = {
  password: "correct-horse",
  role: "user",
  email: "learner@devspace.test",
  fullName: "An",
  avatarUrl: "",
};

describe("validation pipe (AC8)", () => {
  it.each([
    ["a missing field", { ...valid, role: undefined }],
    ["a wrong type", { ...valid, password: 12345678 }],
    ["a short password", { ...valid, password: "short" }],
    ["a role outside the set", { ...valid, role: "root" }],
    ["a malformed email", { ...valid, email: "not-an-email" }],
    ["a non-http avatar URL", { ...valid, avatarUrl: "javascript:alert(1)" }],
    ["an array instead of an object", [valid]],
    ["null", null],
  ])(
    "[AC8] %s is 400 with the generic message, no issue, path or input, and no handler ran",
    async (_name, body) => {
      const before = await handled();
      const response = await postJson(
        "/api/e2e/validate",
        JSON.stringify(body),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(GENERIC);
      expect(await handled()).toBe(before);
    },
  );

  it("[AC8] the refusal never repeats what the client sent", async () => {
    const response = await postJson(
      "/api/e2e/validate",
      JSON.stringify({
        ...valid,
        password: "short",
        email: "secret-marker@nowhere",
      }),
    );
    const text = await response.text();
    expect(response.status).toBe(400);
    for (const leaked of [
      "secret-marker",
      "short",
      "issues",
      "path",
      "too_small",
    ]) {
      expect(text).not.toContain(leaked);
    }
  });

  it("[AC8] a valid body reaches the handler with the transforms of the schema applied", async () => {
    const before = await handled();
    const response = await postJson(
      "/api/e2e/validate",
      JSON.stringify({
        ...valid,
        email: "  Learner@Devspace.test  ",
        fullName: "   ",
        avatarUrl: "  ",
        extra: "dropped",
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      role: "user",
      email: "Learner@Devspace.test",
      fullName: null,
      avatarUrl: null,
    });
    expect(await handled()).toBe(before + 1);
  });

  it("[AC8] text that is not JSON is the same generic 400, never reaches a handler and is not quoted back", async () => {
    const before = await handled();
    for (const text of [
      '{"password": "leak-marker",',
      "leak-marker is not json",
      "null",
    ]) {
      const response = await postJson("/api/e2e/validate", text);
      expect(response.status, text).toBe(400);
      expect(await response.json()).toEqual(GENERIC);
    }
    expect(await handled()).toBe(before);
  });
});

describe("size limits (AC9)", () => {
  // A JSON document of exactly `bytes` bytes: {"a":"xxx…"}.
  const json = (bytes: number) =>
    `{"a":"${"x".repeat(bytes - '{"a":""}'.length)}"}`;

  it("[AC9] JSON of exactly 4 MiB is handled and one byte more is 413", async () => {
    const before = await handled();
    const exact = await postJson("/api/e2e/json", json(4 * MIB));
    expect(exact.status).toBe(201);
    expect(await handled()).toBe(before + 1);

    const over = await postJson("/api/e2e/json", json(4 * MIB + 1));
    expect(over.status).toBe(413);
    expect(
      await handled(),
      "the oversized body never reached the handler",
    ).toBe(before + 1);
  });

  async function upload(bytes: number) {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)]), "file.bin");
    return fetch(`${api.url}/api/e2e/upload`, {
      method: "POST",
      headers: bearer(user),
      body: form,
    });
  }

  it("[AC9] a multipart file of exactly 2 MiB is handled and one byte more is 413", async () => {
    const before = await handled();
    const exact = await upload(2 * MIB);
    expect(exact.status).toBe(201);
    expect(await exact.json()).toEqual({ size: 2 * MIB });

    const over = await upload(2 * MIB + 1);
    expect(over.status).toBe(413);
    expect(
      await handled(),
      "the oversized file never reached the handler",
    ).toBe(before + 1);
  });

  it("[AC9] a multipart text field over 64 KiB is refused with 400 (multer's field limit) and never reaches the handler", async () => {
    const before = await handled();
    const form = new FormData();
    form.append("note", "x".repeat(64 * 1024 + 1));
    form.append("file", new Blob([new Uint8Array(10)]), "file.bin");
    const response = await fetch(`${api.url}/api/e2e/upload`, {
      method: "POST",
      headers: bearer(user),
      body: form,
    });
    expect(response.status).toBe(400);
    expect(await handled()).toBe(before);
  });

  // Writes a request by hand so that the declared length and the bytes sent can differ.
  function raw(
    declared: number,
    sent: string,
    request = {
      path: "/api/e2e/json",
      contentType: "application/json",
    },
  ) {
    return new Promise<{ status: number | null; handlerRan: boolean }>(
      (resolve, reject) => {
        const socket = createConnection({ host: "127.0.0.1", port: api.port });
        let text = "";
        socket.setEncoding("utf8");
        socket.on("data", (chunk) => (text += chunk));
        socket.on("error", reject);
        socket.on("close", () => {
          const status = /^HTTP\/1\.1 (\d{3})/.exec(text);
          resolve({
            status: status ? Number(status[1]) : null,
            handlerRan: /"ok":true/.test(text),
          });
        });
        socket.write(
          [
            `POST ${request.path} HTTP/1.1`,
            `Host: 127.0.0.1:${api.port}`,
            `Authorization: Bearer ${user.accessToken}`,
            `Content-Type: ${request.contentType}`,
            `Content-Length: ${declared}`,
            "Connection: close",
            "",
            sent,
          ].join("\r\n"),
        );
        // Half-close: the client has no more bytes, so the server sees a body shorter than it was promised.
        socket.end();
        setTimeout(() => socket.destroy(), 10_000);
      },
    );
  }

  it("[AC9] a body shorter than its Content-Length is refused, never handled as truncated", async () => {
    const before = await handled();
    const result = await raw(100, '{"a":1}');
    expect(result.handlerRan).toBe(false);
    expect(result.status, "refused explicitly, not left hanging").toBe(400);
    expect(
      await handled(),
      "the truncated body never reached the handler",
    ).toBe(before);
  });

  it("[AC9] a multipart body cut off inside the file part, shorter than its Content-Length, is refused and never handled", async () => {
    const before = await handled();
    const boundary = "devspace-test-boundary";
    const partial = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="file.bin"',
      "Content-Type: application/octet-stream",
      "",
      "x".repeat(1000),
    ].join("\r\n");
    const result = await raw(partial.length + 5000, partial, {
      path: "/api/e2e/upload",
      contentType: `multipart/form-data; boundary=${boundary}`,
    });
    expect(result.handlerRan).toBe(false);
    expect(result.status, "refused explicitly, not left hanging").toBe(400);
    expect(
      await handled(),
      "the truncated upload never reached the handler",
    ).toBe(before);
  });

  it("[AC9] a body that is exactly as long as its Content-Length is handled", async () => {
    const before = await handled();
    const result = await raw(7, '{"a":1}');
    expect(result.status).toBe(201);
    expect(await handled()).toBe(before + 1);
  });
});

describe("handler time limit (AC9)", () => {
  it("[AC9] production's limit is 60 seconds and its cache window is 30 seconds, and no variable changes them", () => {
    const env = readServerEnv({
      DATABASE_URL: "postgresql://devspace_api:x@127.0.0.1:1/postgres",
      SUPABASE_URL: "http://127.0.0.1:1",
      SUPABASE_ANON_KEY: "x",
      ALLOWED_ORIGINS: "http://127.0.0.1:3100",
      REQUEST_TIMEOUT_MS: "1",
      SESSION_CACHE_TTL_MS: "1",
      E2E_REQUEST_TIMEOUT_MS: "1",
      E2E_SESSION_CACHE_TTL_MS: "1",
    });
    expect(env.requestTimeoutMs).toBe(60_000);
    expect(env.sessionCacheTtlMs).toBe(30_000);
  });

  it("[AC9] a handler that finishes within the limit answers normally", async () => {
    const response = await fetch(`${short.url}/api/e2e/slow?ms=200`, {
      headers: bearer(user),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ waited: 200 });
  });

  it("[AC9] a handler still running at the limit is ended with an explicit 504, and the API keeps serving", async () => {
    const started = Date.now();
    const response = await fetch(`${short.url}/api/e2e/slow?ms=2500`, {
      headers: bearer(user),
    });
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({
      message: "The request took too long and was ended.",
      error: "Gateway Timeout",
      statusCode: 504,
    });
    expect(
      Date.now() - started,
      "answered at the limit, not when the handler finished",
    ).toBeLessThan(2000);
    expect(await handled(short)).toBeGreaterThanOrEqual(0);
  });
});
