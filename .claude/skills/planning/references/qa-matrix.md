# Manual QA matrix

Read this when a plan has manual QA that depends on data, user roles or hosted state. Skip it otherwise.

DevSpace has a local Supabase stack with a minimal invented seed (two users, two courses), and no automated browser tests yet. The Owner signs in; agents never enter credentials. So QA is a table the plan writes before implementation reaches its last checkpoint.

## Matrix

One row per scenario:

| # | Who | Action | Expected | Needs |
| --- | --- | --- | --- | --- |
| 1 | <anon, learner, learner who has not enrolled, enrolled learner, admin> | <steps or request> | <observable result, including what must be denied> | <data or account that must exist> |

Cover, where they apply: each role; the allowed path and the denied path; empty, loading and error states; a duplicate submit; the same action from two tabs; data owned by another user.

## Readiness

Decide before the final checkpoint, and record exactly one outcome per matrix:

- the existing hosted data is enough;
- specific accounts or rows must be prepared (list them, who creates them, and how they are cleaned up; a hosted write needs the Owner's approval);
- no data is needed;
- blocked until the Owner provides an account or data.

Say which checks the agent can do (commands, simulated-role SQL by Main, a browser pass with the Owner signed in) and which only the Owner can. Manual QA may stay pending for a local checkpoint, but the plan states when it blocks approval or merge.
