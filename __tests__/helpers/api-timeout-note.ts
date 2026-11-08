import { beforeEach } from "vitest";
import { API_CLEANUP_DEADLINE_MS } from "./api-timeouts";
import {
  runCleanupHook,
  sharedRunMarker,
  type HookContext,
  type RunMarker,
} from "./fixture-ownership";

// The `api` project wiring of QE-P8, as the `rls` files do it (`finishFixtureScope` in __tests__/rls/helpers.ts): a test
// that times out may leave a request in flight (or an API process still handling one), so it makes the run unclean even
// when everything is cleaned up afterwards, and a cleanup that overruns marks the run before it settles.

// Registered by __tests__/api/setup.ts for every file of the project. `onTestFinished` runs after every `afterEach`
// hook of the file, and still runs when one of them throws, which an `afterEach` registered here would not (Vitest runs
// the afterEach hooks in reverse order of registration and stops at the first one that throws).
export function noteTimedOutTests(run: () => RunMarker) {
  beforeEach((context) => {
    context.onTestFinished(() =>
      runCleanupHook(context, run(), async () => {}),
    );
  });
}

type Step = () => unknown;

// Every step runs, in order, although an earlier one failed: a failed session cleanup must not leave an API process
// running. The failure is thrown once all of them ran.
async function runAll(steps: Step[]) {
  const failures: unknown[] = [];
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "several cleanup steps failed");
}

// The whole body of an `afterEach` cleanup hook goes through `runCleanupHook` with the hook's own context, so a hook
// that outlives `hookTimeout` marks the run before its pending step settles. The steps are read when the hook runs.
export function afterEachCleanup(
  steps: () => Step[],
  run: () => RunMarker = sharedRunMarker,
) {
  return (context: HookContext) =>
    runCleanupHook(context, run(), () => runAll(steps()));
}

// An `afterAll` has no signal from Vitest, so it brings its own deadline around the entire body (every step): one that
// outlives it marks the run before it settles, and still runs to its end (cleanup is never skipped because the run is
// unclean).
export function afterAllCleanup(
  name: string,
  steps: () => Step[],
  run: () => RunMarker = sharedRunMarker,
  deadlineMs = API_CLEANUP_DEADLINE_MS,
) {
  return () =>
    runCleanupHook(
      { signal: AbortSignal.timeout(deadlineMs), task: { name } },
      run(),
      () => runAll(steps()),
    );
}
