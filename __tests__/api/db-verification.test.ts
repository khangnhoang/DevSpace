// Test plan
// Goal: the API never queries through a connection whose role was not verified, whichever path reaches the pool first.
// Layer: api (the production build as a process on the test stack, under the network guard).
// Subject: S2 of the TM-U3 correction round, AC13 (startup checks), AC4 (health), ADR 0008 D2 and D7.
// Data: one fixture user, the proof owner, created and deleted through the local Admin API.
// Invariants: a database that cannot be asked is a 503 with no detail and the process keeps serving; a connection that
//   runs as another role ends the process with a non-zero code from the handler path and from the probe path, and no
//   statement of the handler reaches the database.
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  inject,
  it,
} from "vitest";
import { afterEachCleanup, afterAllCleanup } from "../helpers/api-timeout-note";
import {
  apiTestEnv,
  freePort,
  startApi,
  type RunningApi,
} from "../helpers/api-process";
import {
  apiSessions,
  bearer,
  type MintedSession,
} from "../helpers/api-session";
import {
  startCountingProxy,
  type CountingProxy,
} from "../helpers/tcp-counting-proxy";

const stack = inject("apiStack");
const sessions = apiSessions(stack);
let owner: MintedSession;
const running: RunningApi[] = [];
const closers: (() => Promise<void>)[] = [];

beforeAll(async () => {
  owner = await sessions.mint("db-verification");
});

afterEach(
  afterEachCleanup(() => [
    ...closers.splice(0),
    ...running.splice(0).map((api) => () => api.stop()),
  ]),
);

afterAll(afterAllCleanup("db verification", () => [() => sessions.cleanup()]));

function withPort(base: string, port: number) {
  const url = new URL(base);
  url.port = String(port);
  return url.toString();
}

// The API boots against a port nobody listens on, with the connection string of the test stack's own owner role (not
// `devspace_api`). Nothing has been checked then, because the database could not be asked.
async function bootWithDatabaseDown() {
  const port = await freePort();
  const api = await startApi(
    apiTestEnv(stack, {
      DATABASE_URL: withPort(stack.dbUrl, port),
      API_PROOF_ENABLED: "1",
      API_PROOF_USER_ID: owner.userId,
    }),
  );
  running.push(api);
  return { api, port };
}

// The database comes back, as the wrong role: the proxy forwards to the real database and the credentials are the owner's.
async function bringDatabaseBack(port: number): Promise<CountingProxy> {
  const target = new URL(stack.dbUrl);
  const proxy = await startCountingProxy(
    { host: target.hostname, port: Number(target.port) },
    port,
  );
  closers.push(proxy.close);
  return proxy;
}

describe("a connection is verified before the first query (S2)", () => {
  it("[S2] answers 503 with no detail while the database cannot be asked, and /api/health stays up", async () => {
    const { api } = await bootWithDatabaseDown();
    const response = await fetch(`${api.url}/api/proof/read`, {
      headers: bearer(owner),
    });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(
      /postgres|ECONNREFUSED|127\.0\.0\.1/i,
    );
    expect((await fetch(`${api.url}/api/health`)).status).toBe(200);
  });

  it("[S2] a database that comes back as another role ends the process before /api/proof/read queries it", async () => {
    const { api, port } = await bootWithDatabaseDown();
    const proxy = await bringDatabaseBack(port);
    // No health probe ran: the handler is the first caller to need the pool.
    const response = await fetch(`${api.url}/api/proof/read`, {
      headers: bearer(owner),
    }).catch(() => null);
    expect(response?.status ?? 0, "the handler must not answer").not.toBe(200);
    expect(await api.exited, "the process ends non-zero").not.toBe(0);
    expect(api.output()).toContain("devspace_api");
    expect(
      proxy.statements.filter((statement) => /profiles/i.test(statement)),
      "no handler statement reached the database",
    ).toEqual([]);
  });

  it("[S2] the health probe path ends the process too, not a quiet false", async () => {
    const { api, port } = await bootWithDatabaseDown();
    await bringDatabaseBack(port);
    const response = await fetch(`${api.url}/api/health/db`).catch(() => null);
    expect(response?.status ?? 0).not.toBe(200);
    expect(await api.exited).not.toBe(0);
    expect(api.output()).toContain("devspace_api");
  });
});
