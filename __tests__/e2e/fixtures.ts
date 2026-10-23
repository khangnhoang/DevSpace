import { test as base, expect } from "@playwright/test";
import { join } from "node:path";
import { classifyRequest } from "../helpers/e2e-network";
import { recordSize, recordsSince, serverRecordPaths, type GuardRecord, type MailRecord } from "../helpers/e2e-server";
import { openActionCaller, type ActionCaller } from "./server-action";

export { expect };

// Every spec imports `test` from here. The `context` fixture is replaced so that every browser context of the
// suite goes through the network guard: a request to a non-local host is aborted, one aimed at the hosted
// project or the production site is aborted and fails the test, and so does a page error or a 5xx answer
// from a local host. Redirect hops skip the route handler: the browser cannot resolve a non-local host
// (`playwright.config.ts`) and the request listener still reports a hosted hop.
// The guard blocks Monaco's CDN loader on /try_it, and `@monaco-editor/loader` then rejects an unhandled promise
// with the `error` Event of that script element. A row that sets `blockedMonacoLoader` marks exactly that
// rejection as handled in the page, so Playwright never reports it; any other page error still fails the test.
const MONACO_LOADER_PREFIX = "https://cdn.jsdelivr.net/npm/monaco-editor@";
const MONACO_LOADER_SUFFIX = "/min/vs/loader.js";

// The e2e server runs behind the server guard (server-guard.cjs). `mailsSent()` returns the mails the server
// recorded since this test began; a test during which the server tried to resolve or reach a non-local host fails.
export type ServerRecords = { mailsSent: () => MailRecord[] };

export const test = base.extend<{ blockedMonacoLoader: boolean; serverRecords: ServerRecords; callAction: ActionCaller }>({
  blockedMonacoLoader: [false, { option: true }],

  // Posts to a server action endpoint as an actor (server-action.ts). Its contexts are closed after the test.
  callAction: async ({}, provide) => {
    const { call, dispose } = await openActionCaller();
    await provide(call);
    await dispose();
  },

  serverRecords: [
    async ({}, provide) => {
      const paths = serverRecordPaths(join(__dirname, "../.."));
      const guardStart = recordSize(paths.guard);
      const mailStart = recordSize(paths.mail);

      await provide({ mailsSent: () => recordsSince<MailRecord>(paths.mail, mailStart) });

      expect(
        recordsSince<GuardRecord>(paths.guard, guardStart),
        "the e2e server tried to resolve or reach a non-local host",
      ).toEqual([]);
    },
    { auto: true },
  ],

  // The callback is not named `use` (Playwright's usual name): the react-hooks lint rule reads that as a hook.
  context: async ({ context, blockedMonacoLoader }, provide) => {
    // A set, because a hosted request is recorded by the route handler and by the request listener.
    const problems = new Set<string>();

    await context.route("**/*", async (route) => {
      const url = route.request().url();
      const verdict = classifyRequest(url);
      if (verdict === "allow") return route.continue();
      if (verdict === "hosted") problems.add(`request to a hosted host: ${url}`);
      return route.abort("blockedbyclient");
    });
    // Playwright continues a redirect hop itself, without calling the route handler, so classify every request here too.
    context.on("request", (request) => {
      if (classifyRequest(request.url()) === "hosted") problems.add(`request to a hosted host: ${request.url()}`);
    });
    if (blockedMonacoLoader) {
      await context.addInitScript(
        ({ prefix, suffix }) => {
          window.addEventListener("unhandledrejection", (event) => {
            const reason: unknown = event.reason;
            const script = reason instanceof Event ? reason.target : null;
            if (script instanceof HTMLScriptElement && script.src.startsWith(prefix) && script.src.endsWith(suffix)) {
              event.preventDefault();
            }
          });
        },
        { prefix: MONACO_LOADER_PREFIX, suffix: MONACO_LOADER_SUFFIX },
      );
    }
    context.on("weberror", (webError) => problems.add(`page error: ${webError.error().message}`));
    context.on("response", (response) => {
      if (response.status() >= 500) problems.add(`HTTP ${response.status()} from ${response.url()}`);
    });

    await provide(context);

    expect([...problems], "the network guard recorded problems").toEqual([]);
  },
});
