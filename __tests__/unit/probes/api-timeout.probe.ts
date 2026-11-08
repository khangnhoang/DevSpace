// Run only by api-timeout-note.test.ts, in its own Vitest process with a short testTimeout (api-timeout.config.mts).
// It registers the `api` project's hooks the way __tests__/api/setup.ts does, with a marker of its own, and appends
// what happens to the file named by PROBE_LOG: "marked <cause>" when the run is marked, "settled" when the pending
// cleanup finishes, "cleaned" when the fixture of a test is removed.
import { appendFileSync } from "node:fs";
import { afterAll, afterEach, it } from "vitest";
import {
  cleanupWithDeadline,
  noteTimedOutTests,
} from "../../helpers/api-timeout-note";
import type { RunMarker } from "../../helpers/fixture-ownership";

const log = process.env.PROBE_LOG!;
const kind = process.env.PROBE_KIND!;
const note = (line: string) => appendFileSync(log, `${line}\n`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const causes: string[] = [];
const run: RunMarker = {
  check: () => causes[0] ?? null,
  mark: (cause) => {
    causes.push(cause);
    note(`marked ${cause}`);
  },
};

noteTimedOutTests(() => run);

if (kind === "slow-test") {
  // A fixture removed by the test's own afterEach, after the test timed out: the cleanup still runs.
  it("is too slow", async () => {
    await sleep(1500);
  });
  afterEach(() => note("cleaned"));
}

if (kind === "fast-test") {
  it("is quick", () => {});
  afterEach(() => note("cleaned"));
}

if (kind === "slow-cleanup") {
  it("holds a fixture", () => {});
  afterAll(async () => {
    await cleanupWithDeadline(
      run,
      "probe cleanup",
      async () => {
        await sleep(600);
        note("settled");
      },
      150,
    );
  });
}
