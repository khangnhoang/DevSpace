// Test plan
// Goal: the e2e run refuses to start when either of its ports, Next's 3100 or the API's 3101, is taken (TM-U3 AC16).
// Layer: unit. Real listeners on free ports stand in for a leftover server.
// Subject: AC16 of the TM-U3 plan; scripts/e2e/ports.mjs, called by scripts/e2e/run.mjs before anything starts.
import { createServer, type Server } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { E2E_API_PORT, E2E_PORT } from "../helpers/e2e-env";
import { assertPortFree, assertPortsFree } from "../../scripts/e2e/ports.mjs";

const open: Server[] = [];
afterEach(async () => {
  await Promise.all(
    open
      .splice(0)
      .map((server) => new Promise((resolve) => server.close(resolve))),
  );
});

async function listen(): Promise<number> {
  const server = createServer();
  open.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return (server.address() as { port: number }).port;
}

async function freePort(): Promise<number> {
  const port = await listen();
  await new Promise((resolve) => open.pop()!.close(resolve));
  return port;
}

describe("e2e ports", () => {
  it("serves Next and the API on two different ports", () => {
    expect(E2E_PORT).toBe(3100);
    expect(E2E_API_PORT).toBe(3101);
  });

  it("accepts a free port", async () => {
    await expect(assertPortFree(await freePort())).resolves.toBeUndefined();
  });

  it("refuses a port that is taken, naming it", async () => {
    const taken = await listen();
    await expect(assertPortFree(taken)).rejects.toThrow(
      `Port ${taken} is in use`,
    );
  });

  it("refuses when only the first of two ports is taken", async () => {
    const taken = await listen();
    await expect(assertPortsFree([taken, await freePort()])).rejects.toThrow(
      `Port ${taken}`,
    );
  });

  it("refuses when only the second of two ports is taken", async () => {
    const free = await freePort();
    const taken = await listen();
    await expect(assertPortsFree([free, taken])).rejects.toThrow(
      `Port ${taken}`,
    );
  });

  it("accepts two free ports", async () => {
    await expect(
      assertPortsFree([await freePort(), await freePort()]),
    ).resolves.toBeUndefined();
  });
});
