import { it } from "vitest";
import { runKnownBug, type Bug } from "./known-bug-core";

export { runKnownBug, type Bug };

export function knownBug(id: string, title: string, body: (bug: Bug) => Promise<void>): void {
  it(`${id} ${title}`, async ({ annotate }) => {
    await runKnownBug(id, body, async (message) => {
      // The default reporter prints test stdout but hides annotations of a passing test; CI logs need the line.
      console.info(message);
      await annotate(message, "known-bug");
    });
  });
}
