# Charter — quality-engineering

Progress: [progress.md](progress.md). Problems: [problems.md](problems.md). Future features: [future-features.md](future-features.md). Initiative plans live under `implementation-plans/qe-u<n>-<slug>/plan.md`.

## 1. Capability and boundary

- Capability: maintain shared test tooling, safe local test data, regression coverage, lint and CI feedback after the infrastructure delivery program closed.
- Boundary: product behavior, authorization, payment integrity and migrations stay with app-foundation, security-hotfix or their future owner. Tests that ship a product change stay with that change; shared harness maintenance belongs here. Agent instructions stay with agent-workflow; dependency upgrades stay with dependency-maintenance. This program neither reopens infrastructure nor advances the techstack migration.

## 2. Owner decisions

1. (2026-10-30) Open Quality Engineering as an evergreen program for BL-F6 and subsequent testing/CI work; start with test-data ownership, safe cleanup and recovery on a new branch, including PR #41 documentation catch-up.

## 3. Invariants

- Use the existing Vitest, local Supabase and Playwright layers, with checks selected by `test-quality-strategy` — prevents building a replacement test framework.
- Local target, exclusive use and fixture ownership follow `test-quality-strategy`, Test data — prevents cleanup or reset destroying another user's or run's data.
- Service role is limited to setup, read-back and cleanup; requests under test keep their actor — prevents bypassing the guarantee being tested.
- Preserve hosted/network/mail guards and existing observable assertions — prevents a green suite caused by weaker verification.
- Open one approved initiative at a time; future entries grant no implementation — prevents coverage and CI work expanding the active safety fix.

## 4. Initiatives

| Initiative | Branch | Outcome | Dependencies | Gate to open |
| --- | --- | --- | --- | --- |
| QE-U1 [Owned fixtures and safe cleanup](implementation-plans/qe-u1-fixture-ownership/plan.md) | `test/bl-f6-fixture-ownership` | QE-F1: cleanup preserves unrelated data, handles partial failure and supports explicit interrupted-run recovery. | Testing policy delivered in PR #39; current test baseline after PR #41. | r2 approved on 2026-10-30 after independent Codex plan PASS; separate implementor and local checkpoint commits authorized. |

## 5. Opening an initiative

1. Record the Owner-selected work in this program and verify it has one owner.
2. Main discovers current behavior and writes the next detail plan using the `program-docs` template; add its initiative row here.
3. Self-review with `code-review`; use independent plan and diff gates when risk or the Owner requires them. Permissions remain in `AGENTS.md` section 4.
4. Obtain plan approval and implementation authority before assigning the separate implementor session; maintain State in [progress.md](progress.md).
