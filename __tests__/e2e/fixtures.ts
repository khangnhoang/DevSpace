import { test as base, expect } from "@playwright/test";
import { join } from "node:path";
import { classifyRequest } from "../helpers/e2e-network";
import { recordSize, recordsSince, serverRecordPaths, type GuardRecord, type MailRecord } from "../helpers/e2e-server";
import { openActionCaller, type ActionCaller } from "./server-action";
import { beginFixtureScope } from "./service-role";
import { withFixtureScope, type FixtureScope } from "../helpers/fixture-ownership";
import { admitBrowserRequest, forgetEntry } from "../helpers/run-ownership.mjs";
import type { Request } from "@playwright/test";

export { expect };

// Every spec imports `test` from here. The `context` fixture is replaced so that every browser context of the
// suite goes through the network guard: a request to a non-local host is aborted, one aimed at the hosted
// project or the production site is aborted and fails the test, and so does a page error or a 5xx answer
// from a local host. Redirect hops skip the route handler: the browser cannot resolve a non-local host
// (`playwright.config.ts`) and the request listener still reports a hosted hop.
// The e2e server runs behind the server guard (server-guard.cjs). `mailsSent()` returns the mails the server
// recorded since this test began; a test during which the server tried to resolve or reach a non-local host fails.
export type ServerRecords = { mailsSent: () => MailRecord[] };

export const test = base.extend<{ owned: FixtureScope; serverRecords: ServerRecords; callAction: ActionCaller }>({
  owned: [async ({}, provide) => {
    const scope = beginFixtureScope();
    await withFixtureScope(scope, () => provide(scope));
  }, { auto: true }],

  // Posts to a server action endpoint as an actor (server-action.ts). Its contexts are closed after the test.
  callAction: async ({}, provide) => {
    const { call, dispose } = await openActionCaller();
    await provide(call);
    await dispose();
  },

  serverRecords: [
    async ({ owned }, provide) => {
      const paths = serverRecordPaths(join(__dirname, "../.."));
      const guardStart = recordSize(paths.guard);
      const mailStart = recordSize(paths.mail);

      await provide({ mailsSent: () => recordsSince<MailRecord>(paths.mail, mailStart) });
      await owned.cleanup();

      expect(
        recordsSince<GuardRecord>(paths.guard, guardStart),
        "the e2e server tried to resolve or reach a non-local host",
      ).toEqual([]);
    },
    { auto: true },
  ],

  // The callback is not named `use` (Playwright's usual name): the react-hooks lint rule reads that as a hook.
  context: async ({ context, owned }, provide) => {
    await context.setExtraHTTPHeaders({ "X-DevSpace-Fixture-Scope": owned.id });
    // A set, because a hosted request is recorded by the route handler and by the request listener.
    const problems = new Set<string>();
    const pending = new WeakMap<Request, string>();
    context.on("requestfinished", request => {
      const id = pending.get(request);
      if (id) { forgetEntry(owned.ref, id); pending.delete(request); }
    });

    await context.route("**/*", async (route) => {
      const url = route.request().url();
      const verdict = classifyRequest(url);
      if (verdict === "allow") {
        const request = route.request();
        const target = new URL(url);
        if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) && target.origin.replace("localhost", "127.0.0.1") === owned.ref.target.api) {
          try { pending.set(request, admitBrowserRequest(owned.ref, owned.id, target.pathname)); }
          catch { problems.add("mutation attempted after fixture scope closed"); return route.abort("failed"); }
        }
        return route.continue();
      }
      if (verdict === "hosted") problems.add(`request to a hosted host: ${url}`);
      return route.abort("blockedbyclient");
    });
    // Playwright continues a redirect hop itself, without calling the route handler, so classify every request here too.
    context.on("request", (request) => {
      if (classifyRequest(request.url()) === "hosted") problems.add(`request to a hosted host: ${request.url()}`);
    });
    context.on("weberror", (webError) => problems.add(`page error: ${webError.error().message}`));
    context.on("response", (response) => {
      if (response.status() >= 500) problems.add(`HTTP ${response.status()} from ${response.url()}`);
    });

    try { await provide(context); }
    finally { await context.close(); }

    expect([...problems], "the network guard recorded problems").toEqual([]);
  },
});
