import type { BrowserContext, Page } from "@playwright/test";
import { runKnownBug, type Bug } from "../helpers/known-bug-core";
import { test, type ServerRecords } from "./fixtures";
import type { ActionCaller } from "./server-action";

// What a known-bug body can use. Playwright reads the fixtures a test needs from the destructured first
// parameter of the function it is given, so the wrapper below names them one by one.
type RowFixtures = { page: Page; context: BrowserContext; callAction: ActionCaller; serverRecords: ServerRecords };

// The Playwright form of `knownBug` (__tests__/helpers/known-bug.ts): the same contract, the same
// `known bug <id>` line in the run output. Use `expect` from fixtures.ts inside the body.
export function knownBugE2e(id: string, title: string, body: (bug: Bug, fixtures: RowFixtures) => Promise<void>): void {
  test(`${id} ${title}`, async ({ page, context, callAction, serverRecords }, testInfo) => {
    await runKnownBug(
      id,
      (bug) => body(bug, { page, context, callAction, serverRecords }),
      (message) => {
        // The list reporter prints test stdout; the annotation shows in the HTML report.
        console.info(message);
        testInfo.annotations.push({ type: "known-bug", description: message });
      },
    );
  });
}
