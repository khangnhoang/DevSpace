# Verification allocation and manual QA matrix

Read this when verification depends on data, user roles or hosted state. Skip it otherwise.

Selection belongs to [test-quality-strategy](../../test-quality-strategy/SKILL.md#select-checks-from-the-contract). The current local stack has a minimal invented seed (three users and two courses); Vitest `rls` and Playwright API/action fixtures exercise real boundaries, and browser E2E includes U1 deletes/failures as well as rendering and payments. Existing coverage is not a ceiling. Write the allocation before implementation's final checkpoint; do not send every uncovered assertion to manual QA.

## Verification allocation

For each applicable guarantee, record:

| Guarantee / actor / condition | Layer | Assertion | Existing or new file / row | Prerequisites / extension / blocker |
| --- | --- | --- | --- | --- |
| <observable outcome or invariant> | <unit, local integration, browser E2E, justified manual> | <what proves it> | <location, or manual scenario below> | <data, helper support, safe readiness or concrete blocker and resolution> |

Use the policy's coverage model for relevant allowed/denied paths, boundaries, failures and competing operations. Distinct endpoint/RLS guarantees can need both layers; do not duplicate whole matrices. Planned tests and bounded fixture extensions ship with the feature within approved scope.

## Residual manual matrix

One row per scenario:

| # | Who | Action | Expected | Needs | Reason for manual check |
| --- | --- | --- | --- | --- | --- |
| 1 | <actor> | <steps or request> | <observable result, including denial where applicable> | <data/account> | <perceptual judgment, exploration, live provider or explicit approved requirement> |

Keep only justified/required manual scenarios, reusing automated assertions rather than repeating them. Local browser passes sign in as a seed user; any other sign-in is the Owner's (`AGENTS.md` section 4). Preserve approved feature minima and explicit Owner QA; an empty residual matrix needs its reason, not a fabricated browser pass.

## Readiness

Decide before the final checkpoint and record readiness for each scenario (one outcome for a matrix only when all its rows share it):

- the seeded local data is enough;
- specific accounts/rows must be prepared (list them and who creates them): choose stable seed or temporary owned fixtures under [test-quality-strategy](../../test-quality-strategy/SKILL.md#test-data), including the test-stack target, cleanup and the unclean or audit outcome; hosted data follows `AGENTS.md` section 4;
- no data is needed;
- blocked until the Owner provides an account or data.

Say which checks the agent can do (commands, simulated-role SQL by Main, a local browser pass as a seed user) and which only the Owner can. Missing credentials/helper support or an uncertain target stays a concrete blocker, not permission to use hosted or reset shared data. Required manual QA may stay pending locally, but the plan states when it blocks approval or merge.
