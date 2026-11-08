import { afterEach } from "vitest";
import { API_CLEANUP_DEADLINE_MS } from "./api-timeouts";
import { runCleanupHook, type RunMarker } from "./fixture-ownership";

// The `api` project wiring of QE-P8, as the `rls` files do it: a test that times out may leave a request in flight (or
// an API process still handling one), so it makes the run unclean even when everything is cleaned up afterwards.
// Registered by __tests__/api/setup.ts for every file of the project.
export function noteTimedOutTests(run: () => RunMarker) {
  afterEach(async (context) => {
    await runCleanupHook(context, run(), async () => {});
  });
}

// A cleanup in an afterAll has no signal from Vitest, so it brings its own: one that outlives the deadline marks the run
// before it settles, and still runs to its end (cleanup is never skipped because the run is unclean).
export function cleanupWithDeadline<T>(
  run: RunMarker,
  name: string,
  cleanup: () => Promise<T>,
  deadlineMs = API_CLEANUP_DEADLINE_MS,
): Promise<T> {
  return runCleanupHook(
    { signal: AbortSignal.timeout(deadlineMs), task: { name } },
    run,
    cleanup,
  );
}
