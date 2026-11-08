// Test plan
// Goal: the verify mode of scripts/tm-u3-proof exits non-zero unless every temporary surface answers 404, and sends no
//   cookie or token while it asks (AC19).
// Layer: unit. The library with a fake fetch, then the command itself against real local HTTP servers.
// Subject: AC19 of the TM-U3 plan.
// Invariants: any status but 404 (401 and 200 included) fails; a surface that cannot be reached fails; the request carries
//   nothing that identifies a session.
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  API_TEMPORARY_ROUTES,
  APP_TEMPORARY_PAGES,
} from "../../scripts/tm-u3-proof/routes.mjs";
import { verifyAbsent } from "../../scripts/tm-u3-proof/verify.mjs";

const cli = fileURLToPath(
  new URL("../../scripts/tm-u3-proof/cli.mjs", import.meta.url),
);
const respond = (status: number) => async () => new Response(null, { status });

describe("verifyAbsent", () => {
  it("passes when every temporary surface of the API and of the app answers 404", async () => {
    const result = await verifyAbsent({
      apiBase: "http://api.test",
      appBase: "http://app.test",
      fetchImpl: respond(404),
    });
    expect(result.failures).toEqual([]);
    // Every API route on the API, then the page and every API route again through the app.
    expect(result.checked).toBe(
      API_TEMPORARY_ROUTES.length * 2 + APP_TEMPORARY_PAGES.length,
    );
  });

  it("asks about every temporary route with its own method", async () => {
    const seen: string[] = [];
    await verifyAbsent({
      apiBase: "http://api.test",
      fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
        seen.push(`${init?.method} ${new URL(String(url)).pathname}`);
        return new Response(null, { status: 404 });
      },
    });
    expect(seen).toEqual(
      API_TEMPORARY_ROUTES.map(({ method, path }) => `${method} ${path}`),
    );
  });

  it.each([200, 401, 403, 500, 503])(
    "fails when a surface answers %s",
    async (status) => {
      const result = await verifyAbsent({
        apiBase: "http://api.test",
        fetchImpl: async (url: string | URL | Request) =>
          new Response(null, {
            status:
              new URL(String(url)).pathname === "/api/proof/read"
                ? status
                : 404,
          }),
      });
      expect(result.failures).toEqual([
        expect.objectContaining({ method: "GET", status }),
      ]);
    },
  );

  it("fails for a surface it cannot reach: no answer is not absence", async () => {
    const result = await verifyAbsent({
      apiBase: "http://api.test",
      fetchImpl: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    });
    expect(result.failures).toHaveLength(API_TEMPORARY_ROUTES.length);
    expect(result.failures[0].status).toContain("no answer");
  });

  it("sends no cookie, no authorization and no body", async () => {
    const inits: (RequestInit | undefined)[] = [];
    await verifyAbsent({
      apiBase: "http://api.test",
      appBase: "http://app.test",
      fetchImpl: async (_url: string | URL | Request, init?: RequestInit) => {
        inits.push(init);
        return new Response(null, { status: 404 });
      },
    });
    for (const init of inits) {
      expect(init?.headers).toEqual({});
      expect(init?.body).toBeUndefined();
      expect(init?.redirect).toBe("manual");
    }
  });
});

describe("the verify command", () => {
  const servers: Server[] = [];
  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise((resolve) => server.close(resolve))),
    );
  });

  async function serve(
    answer: (request: IncomingMessage) => number,
  ): Promise<string> {
    const server = createServer((request, response) => {
      response.statusCode = answer(request);
      response.end();
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  // Asynchronous on purpose: the servers below live in this process, and a synchronous spawn would block the event
  // loop that has to answer the command.
  const run = (...args: string[]) =>
    new Promise<{ status: number | null; stdout: string; stderr: string }>(
      (resolve) => {
        const child = spawn(process.execPath, [cli, ...args], {
          env: { ...process.env, PROOF_COOKIE: undefined },
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => (stdout += chunk));
        child.stderr.on("data", (chunk) => (stderr += chunk));
        child.on("close", (status) => resolve({ status, stdout, stderr }));
      },
    );

  it("exits 0 when the API and the app answer 404 everywhere", async () => {
    const api = await serve(() => 404);
    const app = await serve(() => 404);
    const result = await run("verify", "--api", api, "--app", app);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("0 not 404");
  });

  it("exits 1 and names the surface when the API still serves one (a 401 is still there)", async () => {
    const api = await serve((request) =>
      request.url === "/api/session" ? 401 : 404,
    );
    const result = await run("verify", "--api", api);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("STILL REACHABLE GET");
    expect(result.stdout).toContain("/api/session -> 401");
  });

  it("exits 1 when the app's page answers 200 although the API is clean", async () => {
    const api = await serve(() => 404);
    const app = await serve((request) =>
      request.url === "/tm-u3-proof" ? 200 : 404,
    );
    const result = await run("verify", "--api", api, "--app", app);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("/tm-u3-proof -> 200");
  });

  it("exits 1 when nothing listens", async () => {
    const api = await serve(() => 404);
    const dead = new URL(api);
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise((resolve) => server.close(resolve))),
    );
    const result = await run(
      "verify",
      "--api",
      `http://127.0.0.1:${dead.port}`,
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("no answer");
  });

  it("exits 2 with a usage line when the API address is missing, and the run mode refuses to start without a cookie", async () => {
    expect((await run("verify")).status).toBe(2);
    const api = await serve(() => 404);
    const noCookie = await run("run", "--api", api);
    expect(noCookie.status).toBe(2);
    expect(noCookie.stderr).toContain("PROOF_COOKIE");
  });
});
