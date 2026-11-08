// Run only by api-timeout-note.test.ts, in its own Vitest process with a short testTimeout and hookTimeout
// (api-timeout.config.mts). It registers the `api` project's hooks the way __tests__/api/setup.ts and the api files do,
// with a marker of its own, and appends what happens to the file named by PROBE_LOG: "marked <cause>" when the run is
// marked, "settled" when a pending cleanup step finishes, "cleaned" when the fixture of a test is removed.
import { appendFileSync } from "node:fs";
import { afterAll, afterEach, it } from "vitest";
import {
  afterAllCleanup,
  afterEachCleanup,
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
const probeRun = () => run;

// The project-wide observer also marks a hook that timed out, so the probe of the hook helper alone runs without it.
if (kind !== "hook-timeout") noteTimedOutTests(probeRun);

if (kind === "slow-test") {
  // A fixture removed by the test's own afterEach, after the test timed out: the cleanup still runs.
  it("is too slow", async () => {
    await sleep(1500);
  });
  afterEach(() => note("cleaned"));
}

if (kind === "slow-test-throwing-cleanup") {
  // The file's own afterEach throws after the timeout, and no helper wraps it: only the project-wide observer can mark.
  it("is too slow", async () => {
    await sleep(1500);
  });
  afterEach(() => {
    note("cleaned");
    throw new Error("the fixture cleanup failed");
  });
}

if (kind === "fast-test") {
  it("is quick", () => {});
  afterEach(() => note("cleaned"));
}

if (kind === "hook-timeout") {
  // An afterEach cleanup that outlives hookTimeout marks the run before its pending step settles.
  it("holds a fixture", () => {});
  afterEach(
    afterEachCleanup(
      () => [
        async () => {
          await sleep(450);
          note("settled");
        },
      ],
      probeRun,
    ),
  );
  // Keeps the process alive until the aborted step has settled; Vitest does not wait for a hook it gave up on.
  afterAll(() => sleep(250));
}

if (kind === "late-step") {
  // The first step ends at once; the one after it overruns the deadline that wraps the whole body.
  it("holds a fixture", () => {});
  afterAll(
    afterAllCleanup(
      "probe cleanup",
      () => [
        async () => note("first step done"),
        async () => {
          await sleep(250);
          note("settled");
        },
      ],
      probeRun,
      150,
    ),
  );
}

if (kind === "failing-step") {
  // A step that throws does not stop the ones after it: nothing is left running.
  it("holds a fixture", () => {});
  afterAll(
    afterAllCleanup(
      "probe cleanup",
      () => [
        async () => {
          throw new Error("the first step failed");
        },
        async () => note("second step ran"),
      ],
      probeRun,
    ),
  );
}
