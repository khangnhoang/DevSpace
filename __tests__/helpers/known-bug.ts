import { it } from "vitest";

type Check = () => void | Promise<void>;
export type Bug = (check: Check) => Promise<void>;

function isAssertionError(error: unknown): boolean {
  return error instanceof Error && error.name === "AssertionError";
}

// Runs a known-bug body. `bug(check)` wraps the single assertion that describes the CORRECT behavior:
// while the bug exists that assertion fails and the test passes. Everything else (a sign-in or network
// error, a failed precondition, a thrown error inside the check) escapes and fails the test, so a broken
// setup never counts as "bug reproduced".
export async function runKnownBug(
  id: string,
  body: (bug: Bug) => Promise<void>,
  report: (message: string) => void = () => {},
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
  if (reproduced) report(`known bug ${id}`);
}

export function knownBug(id: string, title: string, body: (bug: Bug) => Promise<void>): void {
  it(`${id} ${title}`, async ({ annotate }) => {
    await runKnownBug(id, body, (message) => {
      void annotate(message, "known-bug");
    });
  });
}
