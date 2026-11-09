// Test plan
// Goal: the health routes answer without or with the database as specified, the API refuses a bad configuration at
//   startup, and a database that cannot be reached never stops the process.
// Layer: api (the built API as a process on the test stack, under the network guard).
// Subject: AC4 (health), AC13 (startup checks, pool size), AC15 (network guard) of the TM-U3 plan.
// Invariants: every API process ends; the guard refuses nothing a test did not expect; no password is printed.
import { Pool } from "pg";
import { afterEach, describe, expect, inject, it } from "vitest";
import { afterEachCleanup } from "../helpers/api-timeout-note";
import { poolConfig } from "../../backend/src/db/pool";
import {
  apiTestEnv,
  freePort,
  runApiToExit,
  startApi,
  type RunningApi,
} from "../helpers/api-process";
import { API_ROLE_LOCAL_PASSWORD, apiDatabaseUrl } from "../helpers/api-role";
import { startCountingProxy } from "../helpers/tcp-counting-proxy";

const stack = inject("apiStack");
const running: RunningApi[] = [];
const closers: (() => Promise<void>)[] = [];

async function start(overrides: Record<string, string | undefined> = {}) {
  const api = await startApi(apiTestEnv(stack, overrides));
  running.push(api);
  return api;
}

afterEach(
  afterEachCleanup(() => [
    ...closers.splice(0),
    // stop() throws when the guard refused something, so a test cannot pass over a connection outside loopback.
    ...running.splice(0).map((api) => () => api.stop()),
  ]),
);

function urlWithPort(base: string, port: number) {
  const url = new URL(base);
  url.port = String(port);
  return url.toString();
}

describe("health routes (AC4)", () => {
  it("[AC4] /api/health answers ok with the build's commit and uses no database", async () => {
    const closed = await freePort();
    const api = await start({
      DATABASE_URL: urlWithPort(apiDatabaseUrl(stack.dbUrl), closed),
    });
    const response = await fetch(`${api.url}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"ok":true,"commit":"api-test"}');
  });

  it("[AC4] /api/health/db answers ok after select 1 through the pool", async () => {
    const api = await start();
    const response = await fetch(`${api.url}/api/health/db`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"ok":true}');
  });

  it("[AC4] /api/health/db answers 503 with no detail when the database is unreachable, and the API keeps serving", async () => {
    const closed = await freePort();
    const api = await start({
      DATABASE_URL: urlWithPort(apiDatabaseUrl(stack.dbUrl), closed),
    });
    const response = await fetch(`${api.url}/api/health/db`);
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"ok":false}');
    expect(api.output()).not.toContain(API_ROLE_LOCAL_PASSWORD);
    expect((await fetch(`${api.url}/api/health`)).status).toBe(200);
  });

  it("[AC4] sends at most one database probe per 10 seconds however many callers arrive", async () => {
    const dbUrl = new URL(stack.dbUrl);
    const proxy = await startCountingProxy({
      host: dbUrl.hostname,
      port: Number(dbUrl.port),
    });
    closers.push(proxy.close);
    const api = await start({
      DATABASE_URL: urlWithPort(apiDatabaseUrl(stack.dbUrl), proxy.port),
    });
    const probes = () =>
      proxy.statements.filter((statement) =>
        /^select 1$/i.test(statement.trim()),
      ).length;

    const first = await Promise.all(
      Array.from({ length: 40 }, () => fetch(`${api.url}/api/health/db`)),
    );
    expect(first.map((response) => response.status)).toEqual(
      Array(40).fill(200),
    );
    expect(probes(), "40 concurrent callers share one probe").toBe(1);

    await fetch(`${api.url}/api/health/db`);
    expect(probes(), "a caller inside the window reuses the answer").toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 10_200));
    await Promise.all(
      Array.from({ length: 10 }, () => fetch(`${api.url}/api/health/db`)),
    );
    expect(probes(), "the first caller after the window probes again").toBe(2);
  });
});

describe("startup checks (AC13)", () => {
  it("[AC13] exits non-zero and names a missing required variable without printing any value", async () => {
    const result = await runApiToExit(
      apiTestEnv(stack, { DATABASE_URL: undefined }),
    );
    expect(result.code).not.toBe(0);
    expect(result.listened).toBe(false);
    expect(result.output).toContain("DATABASE_URL");
    expect(result.output).not.toContain(API_ROLE_LOCAL_PASSWORD);
    expect(result.output).not.toContain(stack.anonKey);
  });

  it("[AC13] exits non-zero and prints nothing of a malformed DATABASE_URL but its name", async () => {
    const marker = "FAKE-SECRET-MARKER-7q";
    const result = await runApiToExit(
      apiTestEnv(stack, {
        DATABASE_URL: `postgresql://devspace_api:${marker}@db.example:notaport/postgres`,
      }),
    );
    expect(result.code).not.toBe(0);
    expect(result.listened).toBe(false);
    expect(result.output).toContain("DATABASE_URL");
    expect(result.output).not.toContain(marker);
    expect(result.output).not.toContain("db.example");
  });

  it("[AC13] exits non-zero when the connection runs as another database user", async () => {
    const result = await runApiToExit(
      apiTestEnv(stack, { DATABASE_URL: stack.dbUrl }),
    );
    expect(result.code).not.toBe(0);
    expect(
      result.listened,
      "a process with the wrong role must never serve",
    ).toBe(false);
    expect(result.output).toContain("devspace_api");
    // The local password equals the user name, so the check is on the whole connection string instead.
    expect(result.output).not.toContain(stack.dbUrl);
  });

  it("[AC13] the pool never holds more than 5 connections", async () => {
    const pool = new Pool(poolConfig(apiDatabaseUrl(stack.dbUrl)));
    try {
      const rows = await Promise.all(
        Array.from({ length: 14 }, () =>
          pool.query<{ pid: number }>(
            "select pg_sleep(0.4), pg_backend_pid() as pid",
          ),
        ),
      );
      const pids = new Set(rows.map((result) => result.rows[0].pid));
      expect(pids.size).toBeGreaterThan(1);
      expect(pids.size).toBeLessThanOrEqual(5);
    } finally {
      await pool.end();
    }
  });
});

describe("network guard (AC15)", () => {
  it("[AC15] refuses and records a connection outside loopback, so a test that does not expect one fails", async () => {
    const api = await startApi(
      apiTestEnv(stack, {
        DATABASE_URL:
          "postgresql://devspace_api:x@db.hosted-project.invalid:5432/postgres",
      }),
    );
    // The startup role check tried to resolve the name; the API still serves because an unreachable database does not stop it.
    expect((await fetch(`${api.url}/api/health`)).status).toBe(200);
    await expect(api.stop()).rejects.toThrow(
      /network guard refused the API: connect db\.hosted-project\.invalid/,
    );
  });
});
