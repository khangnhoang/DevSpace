# Test-plan header and known bugs

Read this when you start an rls test file, record a known bug, or turn one into a normal test. Skip it for a unit test of a pure function.

## Test-plan header

Every rls file, and any file with several related cases, starts with a comment in English:

```ts
// Test plan
// Goal: <the guarantee, one sentence>
// Layer: rls (local Supabase stack, requests through the API as each actor).
// Subject: <the tables, policies, grants, functions or triggers under test>
// Allowed paths: <who may do what>
// Denied paths: <who must be refused, and how>
// Known bugs: <problem ID and one phrase, or none>
// Invariants: <what the file leaves unchanged and how it cleans up>
```

There is no "last result" field: it goes stale. Results belong in the report.

## Known bug pattern

A known bug is a defect that is recorded in a problems file and not fixed in this change; the wrapper is reserved for it. A defect fixed in this change gets an ordinary regression test (Regression in `SKILL.md`), and a defect not yet recorded is reported to Main first, never wrapped. Its test must keep running, must fail loudly when anything else breaks, and must tell you when the bug is fixed. Use `knownBug` from `__tests__/helpers/known-bug.ts` (Vitest) or `knownBugE2e` from `__tests__/e2e/known-bug.ts` (Playwright; `bug(...)` wraps a Playwright `expect`); plain `test.fails` and skipped tests are not allowed for this, because they also pass when sign-in, the network or a query is broken.

```ts
knownBug("<ID>", "[K3] a learner can change their own profiles.email", async (bug) => {
  // 1. Preconditions, plain expect: the row exists and holds its initial value.
  // 2. The request. Plain expect that it reached the database: no error, or only the expected 42501.
  // 3. Read the persisted state back through the service role.
  // 4. Only the assertion that describes the CORRECT behavior goes inside bug(...).
  await bug(() => expect(after.email).toBe(SEED_EMAIL));
});
```

- While the bug exists, the correct-behavior assertion fails, the test passes and the run prints `known bug <id>`.
- When the bug is fixed the assertion holds and the test fails with "`<id>` no longer reproduces: turn this into a normal test". Move the assertion out of `bug(...)`, rename the test to a normal one, and remove `knownBug`.
- Anything else fails the test: a failed precondition, a sign-in or network error, an unexpected error code such as `23505`, an error thrown inside the check, a body that never reaches `bug(...)`, or two `bug(...)` calls.
- Update the problem record's status when the test turns normal; who edits state records is owned by [`AGENTS.md`](../../../../AGENTS.md) section 2 (Roles).
- The helper's own unit test (`__tests__/unit/known-bug.test.ts`) covers all three outcomes. Change the helper only with that test.
- A surprising behavior you find while writing a test is not encoded as expected. Stop on that case and report the observed response to Main.
