# RLS test design

Read this when you write or review an rls test, change the seed for one, or debug a flaky run. Skip it for a unit test.

## Actors and requests

- Send the request under test as the actor, through the local API with `@supabase/supabase-js`: `anon` (no session), `learner`, `student`, `admin` from `__tests__/rls/helpers.ts`. Each actor signs in once per run in the global setup (the local Auth limit is 30 sign-ins per 5 minutes); a test never signs in again.
- A sign-up test (the only one is P12) uses `newAnonClient()`: `signUp` keeps the new session in memory even with sessions off, and a shared client would then send that user's token. Delete the user afterwards, even on failure.
- A function that returns `trigger` cannot be called through the API; read the catalog through `withPg` (for example `has_function_privilege`).

## The service role

`fixtures` (service role) bypasses RLS. Use it only to prepare fixtures, to read state back and prove a write did or did not happen, and to clean up. It never sends the request under test; a test that passes because the service role did the work tests nothing. Wrap fixture queries in `must(...)` so a failed setup, read-back or cleanup fails the test.

## Reading results

- A denied write asserts `expectDenied(error)`, which requires code `42501` (RLS or privilege), then reads the table back through `fixtures` to prove nothing was written. A constraint error (`23505`, `23503`) never counts as a denial: the policy was not reached.
- A write that a policy filters out (an `update` or `delete` on a row the actor cannot see) returns no error and zero rows: assert `data` equals `[]`, then read the row back to prove it is unchanged.
- A column the actor has no grant on answers `42501`; a column that does not exist answers `42703`.
- A select that must return nothing first proves, through `fixtures`, that the hidden rows exist. Otherwise an empty seed passes for the wrong reason.
- Add `.select()` to a write only when the actor may read the row back. PostgREST reports a denied read-back of the new row as an insert error (`42501`), which looks like a denied insert. When the actor cannot read the row, insert without returning and verify through `fixtures`.

## Data and cleanup

- Restore every seed row a test changes and delete every row it adds in `afterEach`, through `fixtures`, even when the test failed. Restore a changed seed row before deleting by marker, so the marker delete cannot remove it.
- Rows a test creates carry the marker `rls-test`. Never delete or reuse an id from the seed except to restore it.
- `GENERATED ALWAYS` identity tables (`comments`, `coupons`, `enrollments`, `notes`, `notifications`, `payments`, `reviews`) take explicit seed ids only with `overriding system value`; move the sequence past the seed ids. `reviews` and `enrollments` are unique on user and course, so a seeded review would turn a policy test into a `23505`.
- After a seed or schema change, or a killed run, `npx supabase db reset` restores the baseline; a leftover row is the usual cause of a second-run failure.

## Adding a test for a policy or grant change

1. Name the actor, the command (select, insert, update, delete) and the USING and WITH CHECK predicate you expect.
2. Add one allowed test and one denied test per changed command, including owner, enrolled, other-user, anon and admin where they differ.
3. Add the seed rows the case needs (invented, `.test` addresses), then run `npx supabase db reset` and `npm test` twice.
4. Check the test fails when the policy is broken, for example by revoking or loosening it on the local stack with `psql` and resetting afterwards.
