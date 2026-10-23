# Domain review dimensions

Read this when a review inspects validation, database or concurrency, frontend, tests, security, performance or git state. Apply only the dimensions that fit the change.

## Validation and trust boundaries

Skill: `server-actions`. Check that untrusted input is validated on the server and the validated value is used, not the raw payload; auth and ownership are checked inside the action, separate from validation; client-sent ids, prices and roles are ignored or recomputed; side effects happen after validation and permission; results and errors have a consistent shape and leak nothing internal; uploads and webhooks are treated as untrusted.

## Database and concurrency

Skill: `supabase-migration`. Check that the migration is safe for existing data and has a `.down.sql`; constraints come after a valid backfill; RLS covers every command and role; no policy recursion; `security definer` is justified with a fixed `search_path` and revoked-then-granted execute; grants and default ACLs on new views and functions are explicit; state transitions are permission-checked and idempotent; locks are short; no external call under a lock; rollout order is compatible with old and new code.

## Frontend and UX

Skills: `frontend-workflow`, `frontend-design`. Check the hierarchy and primary, secondary and destructive actions; loading, empty, error, success, pending and disabled states; input preserved on error; double submit and stale responses; permission-dependent rendering; null and long content; mobile; accessibility and dialog context; real integration instead of fake success.

## Tests and verification

Skill: `test-quality-strategy`. DevSpace has unit and RLS tests (`npm test`) and a Playwright suite (`npm run test:e2e`): a smoke plus payment rows that call the payment server actions directly. The other server actions have no tests. Check that the tests assert the promised behavior at the right layer, cover denied and hostile paths, are deterministic and clean up after themselves; that a policy, grant or security change adds or updates RLS tests; that a known bug runs through `knownBug` (Vitest) or `knownBugE2e` (Playwright) and is never a skipped test or `test.fails`; and that the plan's commands and manual steps cover whatever the tests do not. Failures are reported rather than hidden, and nothing claims coverage that was not run.

## Security, performance and comments

A security finding names the actor, entry point, missing boundary, impact and mitigation. Performance: only realistic risks (N+1 queries, unbounded work, missing pagination, duplicate requests, request waterfalls, large payloads, lock duration); no speculative optimization. Comments: stale, redundant or missing ones where a hidden constraint exists (`.claude/rules.md` section 9).

## Git state

Coherent commits in English Conventional Commit form, correct baseline, no unrelated files, secrets or build artifacts, no staged surprises, and no remote action beyond the grant (`git-pr-workflow`).
