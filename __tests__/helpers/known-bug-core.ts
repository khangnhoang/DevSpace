type Check = () => void | Promise<void>;
export type Bug = (check: Check) => Promise<void>;

// The failure of an assertion, not any other error. Vitest's `expect` throws an `AssertionError`. Playwright's
// `expect` throws a plain `Error` (its class is not exported) that carries the `matcherResult` of the failed
// matcher; a TypeError or a timeout of another kind has none, and stays a failure of the test.
function isAssertionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AssertionError") return true;
  const { matcherResult } = error as { matcherResult?: unknown };
  return typeof matcherResult === "object" && matcherResult !== null && (matcherResult as { pass?: unknown }).pass === false;
}

// Runs a known-bug body. `bug(check)` wraps the single assertion that describes the CORRECT behavior:
// while the bug exists that assertion fails and the test passes. Everything else (a sign-in or network
// error, a failed precondition, a thrown error inside the check) escapes and fails the test, so a broken
// setup never counts as "bug reproduced". It imports no test runner: `knownBug` (Vitest) and `knownBugE2e`
// (Playwright) wrap it.
export async function runKnownBug(
  id: string,
  body: (bug: Bug) => Promise<void>,
  report: (message: string) => void | Promise<void> = () => {},
): Promise<void> {
  let calls = 0;
  let reproduced = false;
  let fixed = false;

  const bug: Bug = async (check) => {
    calls += 1;
    if (calls > 1) throw new Error(`known bug ${id}: bug(...) may wrap only one assertion`);
    try {
      await check();
      fixed = true;
    } catch (error) {
      if (!isAssertionError(error)) throw error;
      reproduced = true;
    }
  };

  await body(bug);

  if (calls === 0) throw new Error(`known bug ${id}: the test never reached its bug(...) assertion`);
  if (fixed) throw new Error(`${id} no longer reproduces: turn this into a normal test and remove knownBug.`);
  if (reproduced) await report(`known bug ${id}`);
}
