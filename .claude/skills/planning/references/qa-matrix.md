# Manual QA matrix

Read this when a plan has manual QA that depends on data, user roles or hosted state. Skip it otherwise.

DevSpace has a local Supabase stack with a minimal invented seed (three users: a learner, a student enrolled in the paid course and an admin; two courses), RLS tests for the database boundaries, and a Playwright suite (`npm run test:e2e`) that covers the smoke paths of the main learner and admin flows and the payment rows; nothing else automated drives a browser. Rows that only prove a policy or grant belong in `__tests__/rls` (`test-quality-strategy`); the manual matrix keeps what only a browser shows. The Owner signs in; agents never enter credentials. So QA is a table the plan writes before implementation reaches its last checkpoint.

## Matrix

One row per scenario:

| # | Who | Action | Expected | Needs |
| --- | --- | --- | --- | --- |
| 1 | <anon, learner, learner who has not enrolled, enrolled learner, admin> | <steps or request> | <observable result, including what must be denied> | <data or account that must exist> |

Cover, where they apply: each role; the allowed path and the denied path; empty, loading and error states; a duplicate submit; the same action from two tabs; data owned by another user.

## Readiness

Decide before the final checkpoint, and record exactly one outcome per matrix:

- the seeded local data is enough;
- specific accounts or rows must be prepared (list them and who creates them): local data is a seed row under the seed rule in [test-quality-strategy](../../test-quality-strategy/SKILL.md) (Test data); a hosted write needs the Owner's approval first and is cleaned up afterwards;
- no data is needed;
- blocked until the Owner provides an account or data.

Say which checks the agent can do (commands, simulated-role SQL by Main, a browser pass with the Owner signed in) and which only the Owner can. Manual QA may stay pending for a local checkpoint, but the plan states when it blocks approval or merge.
