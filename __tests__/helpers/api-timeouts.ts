// The hook timeout of the `api` project, shared by vitest.config.mts and the cleanup deadline below so they cannot
// drift apart.
export const API_HOOK_TIMEOUT_MS = 30_000;
// A cleanup still running at this point marks the run before Vitest aborts the hook (which it does not report to an
// afterAll, where there is no signal to listen to), so no later scope opens while it runs.
export const API_CLEANUP_DEADLINE_MS = API_HOOK_TIMEOUT_MS - 3_000;
