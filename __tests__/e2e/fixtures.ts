import { test as base, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyRequest } from "../helpers/e2e-network";
import {
  recordSize,
  recordsSince,
  serverRecordPaths,
  type ApiRecord,
  type AuthRecord,
  type GuardRecord,
  type MailRecord,
} from "../helpers/e2e-server";
import {
  openActionCaller,
  type ActionCaller,
  type ActionRefusal,
} from "./server-action";
import { beginFixtureScope } from "./service-role";
import {
  noteTimeout,
  withFixtureScope,
  type FixtureScope,
} from "../helpers/fixture-ownership";

export { expect };

// The global the Monaco loader sets on a page that shows the editor; rows read the editor through it.
declare global {
  interface Window {
    monaco: typeof import("monaco-editor");
  }
}

// Every spec imports `test` from here. The `context` fixture is replaced so that every browser context of the
// suite goes through the network guard: a request to a non-local host is aborted, one aimed at the hosted
// project or the production site is aborted and fails the test, and so does a page error or a 5xx answer
// from a local host. Redirect hops skip the route handler: the browser cannot resolve a non-local host
// (`playwright.config.ts`) and the request listener still reports a hosted hop.
// The e2e server runs behind the server guard (server-guard.cjs). `mailsSent()` returns the mails the server
// recorded since this test began; a test during which the server tried to resolve or reach a non-local host fails.
// `authCalls()` lists the refresh and token-check calls the server sent to Auth since the test began (QE-P7).
export type ServerRecords = {
  mailsSent: () => MailRecord[];
  authCalls: () => AuthRecord[];
  // The requests the e2e API answered since the test began (TM-U3), from its own record.
  apiCalls: () => ApiRecord[];
  // What the Next server printed since the test began.
  nextLog: () => string;
};

function reportableUrl(value: string) {
  const url = URL.parse(value);
  // A redirect can carry a one-time secret even when it reaches an unexpected route.
  return url && (url.protocol === "http:" || url.protocol === "https:")
    ? `${url.origin}${url.pathname}`
    : "non-HTTP URL";
}

export const test = base.extend<{
  owned: FixtureScope;
  serverRecords: ServerRecords;
  callAction: ActionCaller;
  callActionRefused: ActionRefusal;
}>({
  owned: [
    async ({}, provide, testInfo) => {
      const scope = beginFixtureScope();
      // A timed-out test may leave a request in flight, so it makes the run unclean even when the cleanup succeeds.
      await withFixtureScope(scope, () =>
        provide(scope).finally(() => {
          if (testInfo.status === "timedOut") noteTimeout(testInfo.title);
        }),
      );
    },
    { auto: true },
  ],

  // Posts to a server action endpoint as an actor (server-action.ts). Its contexts are closed after the test.
  callAction: async ({}, provide) => {
    const { call, dispose } = await openActionCaller();
    await provide(call);
    await dispose();
  },

  // A call that must be refused before the action runs, from an origin the row names (server-action.ts).
  callActionRefused: async ({}, provide) => {
    const { refuse, dispose } = await openActionCaller();
    await provide(refuse);
    await dispose();
  },

  serverRecords: [
    async ({ owned }, provide) => {
      const paths = serverRecordPaths(join(__dirname, "../.."));
      const guardStart = recordSize(paths.guard);
      const mailStart = recordSize(paths.mail);
      const authStart = recordSize(paths.auth);
      const apiStart = recordSize(paths.api);
      const nextStart = recordSize(paths.next);

      await provide({
        mailsSent: () => recordsSince<MailRecord>(paths.mail, mailStart),
        authCalls: () => recordsSince<AuthRecord>(paths.auth, authStart),
        apiCalls: () => recordsSince<ApiRecord>(paths.api, apiStart),
        nextLog: () =>
          readFileSync(paths.next).subarray(nextStart).toString("utf8"),
      });
      await owned.cleanup();

      expect(
        recordsSince<GuardRecord>(paths.guard, guardStart),
        "the e2e server tried to resolve or reach a non-local host",
      ).toEqual([]);
    },
    { auto: true },
  ],

  // The callback is not named `use` (Playwright's usual name): the react-hooks lint rule reads that as a hook.
  context: async ({ context }, provide) => {
    // A set, because a hosted request is recorded by the route handler and by the request listener.
    const problems = new Set<string>();

    await context.route("**/*", async (route) => {
      const url = route.request().url();
      const verdict = classifyRequest(url);
      if (verdict === "allow") return route.continue();
      if (verdict === "hosted")
        problems.add(`request to a hosted host: ${reportableUrl(url)}`);
      return route.abort("blockedbyclient");
    });
    // Playwright continues a redirect hop itself, without calling the route handler, so classify every request here too.
    context.on("request", (request) => {
      if (classifyRequest(request.url()) === "hosted")
        problems.add(
          `request to a hosted host: ${reportableUrl(request.url())}`,
        );
    });
    context.on("weberror", (webError) =>
      problems.add(`page error: ${webError.error().message}`),
    );
    context.on("response", (response) => {
      if (response.status() >= 500)
        problems.add(
          `HTTP ${response.status()} from ${reportableUrl(response.url())}`,
        );
    });

    try {
      await provide(context);
    } finally {
      await context.close();
    }

    expect([...problems], "the network guard recorded problems").toEqual([]);
  },
});
