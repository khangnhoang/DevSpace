# Domain review dimensions

Read this when a review inspects validation, database or concurrency, frontend, tests, security, performance or git state. Apply only the dimensions that fit the change.

## Validation and trust boundaries

Skill: `server-actions`. Check that untrusted input is validated on the server and the validated value is used, not the raw payload; auth and ownership are checked inside the action, separate from validation; client-sent ids, prices and roles are ignored or recomputed; side effects happen after validation and permission; results and errors have a consistent shape and leak nothing internal; uploads and webhooks are treated as untrusted.

## Database and concurrency

Skill: `supabase-migration`. Check that the migration is safe for existing data and has a `.down.sql`; constraints come after a valid backfill; RLS covers every command and role; no policy recursion; `security definer` is justified with a fixed `search_path` and revoked-then-granted execute; grants and default ACLs on new views and functions are explicit; state transitions are permission-checked and idempotent; locks are short; no external call under a lock; rollout order is compatible with old and new code.

## Frontend and UX

Skills: `frontend-workflow`, `frontend-design`. Check the hierarchy and primary, secondary and destructive actions; loading, empty, error, success, pending and disabled states; input preserved on error; double submit and stale responses; permission-dependent rendering; null and long content; mobile; accessibility and dialog context; real integration instead of fake success.

## Tests and verification

Skill: [test-quality-strategy](../../test-quality-strategy/SKILL.md) (Select checks from the contract, Coverage model, Test data, current layer capabilities and commands). Check the guarantee-to-assertion/layer/file/prerequisite mapping, relevant denied/hostile/failure/race paths and distinct endpoint/RLS boundaries without duplicate matrices. Missing fixtures need a scoped extension shipping with the feature or a concrete blocker/resolution, not automatic manual fallback. Check deterministic owned data, tests aimed at the test stack and never the dev stack, setup/test failure cleanup and the unclean or audit outcome of an interrupted run; do not mistake legacy cleanup for enforcement. A policy, grant or security change adds/updates RLS tests; known bugs use `knownBug` or `knownBugE2e`, never skipped tests or `test.fails`. Residual manual checks have scenario-specific reasons and retain explicit Owner/approved acceptance minima. Failures and unrun probes remain visible; claims match executed assertions.

## Security, performance and comments

A security finding names the actor, entry point, missing boundary, impact and mitigation. Performance: only realistic risks (N+1 queries, unbounded work, missing pagination, duplicate requests, request waterfalls, large payloads, lock duration); no speculative optimization. Comments: stale, redundant or missing ones where a hidden constraint exists ([AGENTS.md](../../../../AGENTS.md), Core engineering rules, rule 13).

## Git state

Coherent commits in English Conventional Commit form, correct baseline, no unrelated files, secrets or build artifacts, no staged surprises, and no remote action beyond the grant (`git-pr-workflow`).
