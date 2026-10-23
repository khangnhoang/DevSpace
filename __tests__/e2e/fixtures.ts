import { test as base, expect } from "@playwright/test";
import { classifyRequest } from "../helpers/e2e-network";

export { expect };

// Every spec imports `test` from here. The `context` fixture is replaced so that every browser context of the
// suite goes through the network guard: a request to a non-local host is aborted, one aimed at the hosted
// project or the production site is aborted and fails the test, and so does a page error or a 5xx answer
// from a local host. Redirect hops skip the route handler: the browser cannot resolve a non-local host
// (`playwright.config.ts`) and the request listener still reports a hosted hop.
// The guard blocks Monaco's CDN loader on /try_it, and `@monaco-editor/loader` then rejects an unhandled promise
// with an `Event`, which Playwright reports as a page error with an empty name. Only a row that sets
// `blockedMonacoLoader` tolerates that one error, and only after the loader request has failed.
const MONACO_LOADER_URL = "https://cdn.jsdelivr.net/npm/monaco-editor@";

export const test = base.extend<{ blockedMonacoLoader: boolean }>({
  blockedMonacoLoader: [false, { option: true }],

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
    let monacoLoaderFailed = false;
    context.on("requestfailed", (request) => {
      if (request.url().startsWith(MONACO_LOADER_URL)) monacoLoaderFailed = true;
    });
    context.on("weberror", (webError) => {
      const error = webError.error();
      const monacoEvent = blockedMonacoLoader && monacoLoaderFailed && !error.name && error.message === "Event";
      if (!monacoEvent) problems.add(`page error: ${error.message}`);
    });
    context.on("response", (response) => {
      if (response.status() >= 500) problems.add(`HTTP ${response.status()} from ${response.url()}`);
    });

    await provide(context);

    expect([...problems], "the network guard recorded problems").toEqual([]);
  },
});
