import { test as base, expect } from "@playwright/test";
import { classifyRequest } from "../helpers/e2e-network";

export { expect };

// Every spec imports `test` from here. The `context` fixture is replaced so that every browser context of the
// suite goes through the network guard: a request to a non-local host is aborted, one aimed at the hosted
// project or the production site is aborted and fails the test, and so does a page error or a 5xx answer
// from a local host.
export const test = base.extend({
  // The callback is not named `use` (Playwright's usual name): the react-hooks lint rule reads that as a hook.
  context: async ({ context }, provide) => {
    const problems: string[] = [];

    await context.route("**/*", async (route) => {
      const url = route.request().url();
      const verdict = classifyRequest(url);
      if (verdict === "allow") return route.continue();
      if (verdict === "hosted") problems.push(`request to a hosted host: ${url}`);
      return route.abort("blockedbyclient");
    });
    context.on("weberror", (webError) => problems.push(`page error: ${webError.error().message}`));
    context.on("response", (response) => {
      if (response.status() >= 500) problems.push(`HTTP ${response.status()} from ${response.url()}`);
    });

    await provide(context);

    expect(problems, "the network guard recorded problems").toEqual([]);
  },
});
