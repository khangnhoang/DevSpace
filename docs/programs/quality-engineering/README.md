# Charter — quality-engineering

Progress: [progress.md](progress.md). Problems: [problems.md](problems.md). Future features: [future-features.md](future-features.md). Initiative plans live under `implementation-plans/qe-u<n>-<slug>/plan.md`.

## 1. Capability and boundary

- Capability: maintain shared test tooling, safe local test data, regression coverage, lint and CI feedback after the infrastructure delivery program closed.
- Boundary: product behavior, authorization, payment integrity and migrations stay with app-foundation, security-hotfix or their future owner. Tests that ship a product change stay with that change; shared harness maintenance belongs here. Agent instructions stay with agent-workflow; dependency upgrades stay with dependency-maintenance. This program neither reopens infrastructure nor advances the techstack migration.

## 2. Owner decisions

1. (2026-10-30) Open Quality Engineering as an evergreen program for BL-F6 and subsequent testing/CI work; start with test-data ownership, safe cleanup and recovery on a new branch, including PR #41 documentation catch-up.
2. (2026-11-01) Address QE-P1 as QE-U2 on a new branch: bounded writer-exit wait before teardown release, and a measured `rls` test timeout.
3. (2026-11-01) Address QE-P2 and QE-F5 (from BL-F3) as QE-U3 on `test/qe-p2-test-stack`: a separate test stack started, checked and reset when needed by the test commands, one machine-wide lock instead of the ownership journal, and CI on the same commands.
4. (2026-11-04) Address QE-F8 as QE-U4 on `test/qe-component-tests`, beside the PR 60 docs catch-up: jsdom with Testing Library (React, DOM, user-event, jest-dom), module mocks at the component's data, router and toast calls, component tests added to the test-selection matrix, and C2 moved if coverage is equivalent. An e2e row stays only for an integration boundary that needs real verification; QE-F8 stays open, tracking the audit of every existing e2e row, with no bulk move in QE-U4.
5. (2026-11-07) Address QE-P5, QE-P7 and QE-P8 as QE-U5 on `test/qe-flaky-harness`, beside the SE-U1 and PR 73 docs catch-up; an intermittent failure that does not reproduce within a bounded attempt gets diagnostics, the PR still merges and the entry stays open; the e2e coverage work (BL-F2, the QE-F8 audit) is a later PR; focused checks replace the 10 full `npm test` and 5 full e2e confirmation runs in the exit conditions of QE-P5 and QE-P7.
6. (2026-11-07) Address QE-F10 (moved from BL-F2) and the QE-F8 audit as QE-U6 on `test/qe-e2e-coverage`, beside the QE-U5 docs catch-up: cover the U6 manual-pass gaps at the smallest sufficient layer, and classify every e2e row without moving one; the moves are a later initiative, form by form.

## 3. Invariants

- Use the existing Vitest, local Supabase and Playwright layers, with checks selected by `test-quality-strategy` — prevents building a replacement test framework.
- The test stack, its lock and fixture ownership follow `test-quality-strategy` (Test stack, Test data); tests never write to the dev stack — prevents cleanup or reset destroying manual-QA data or another run's data.
- Service role is limited to setup, read-back and cleanup; requests under test keep their actor — prevents bypassing the guarantee being tested.
- Preserve hosted/network/mail guards and existing observable assertions — prevents a green suite caused by weaker verification.
- Open one approved initiative at a time; future entries grant no implementation — prevents coverage and CI work expanding the active safety fix.

## 4. Initiatives

| Initiative | Branch | Outcome | Dependencies | Gate to open |
| --- | --- | --- | --- | --- |
| QE-U1 [Owned fixtures and safe cleanup](implementation-plans/qe-u1-fixture-ownership/plan.md) | `test/bl-f6-fixture-ownership` | QE-F1: cleanup preserves unrelated data, handles partial failure and supports explicit interrupted-run recovery. | Testing policy delivered in PR #39; current test baseline after PR #41. | r2 approved on 2026-10-30 after independent Codex plan PASS; separate implementor and local checkpoint commits authorized. |
| QE-U2 [Windows full-suite teardown and preflight timing](implementation-plans/qe-u2-windows-teardown/plan.md) | `test/qe-p1-windows-teardown` | QE-P1: a passing Windows full suite releases ownership despite late RLS worker exit; preflight has a measured timeout; guards stay fail-closed. | QE-U1 ownership lifecycle (PR #42). | r1 approved on 2026-11-01; separate implementor and local checkpoint commits authorized. |
| QE-U3 [Separate test stack and simplified test-data ownership](implementation-plans/qe-u3-test-stack/plan.md) | `test/qe-p2-test-stack` | QE-P2 and QE-F5: tests run on their own stack that the commands start, check and reset when needed; one lock replaces the ownership journal; the dev stack is never touched by tests. | QE-U2 (PR #46). | r4 approved on 2026-11-01 after the Codex plan gate (r1 to r3 failed it); delivered in PR #50 (`60c369a`) on 2026-11-02. |
| QE-U4 [Component tests for client components](implementation-plans/qe-u4-component-tests/plan.md) | `test/qe-component-tests` | QE-F8, first step: a `components` Vitest project in jsdom with Testing Library, run by `npm run test:unit`; `CourseFormDialog` tests; component tests listed as a layer and the e2e rule (a row stays only for an integration boundary) in `test-quality-strategy`; C2 moved on equivalent coverage. QE-F8 stays open for the e2e audit. | QE-U3 (PR #50); AF-U5 (PR 60) for `CourseFormDialog`. | Merged in PR 61 (`78c80ba`) on 2026-11-04. |
| QE-U5 [Flaky harness fixes and fixture guards](implementation-plans/qe-u5-flaky-harness/plan.md) | `test/qe-flaky-harness` | QE-P8: a fixture write cannot outlive its test's timeout or a timed-out cleanup without the run turning unclean; QE-P5 and QE-P7 fixed at a named cause or instrumented after a bounded attempt; SE-U1 and PR 73 docs catch-up. | QE-U3 lock and run state (PR #50); QE-U4 (PR 61). | r3 approved on 2026-11-07 after the Codex plan gate (PASS in round 3); merged in PR 74 (`259f123`) on 2026-11-07. |
| QE-U6 [E2e coverage gaps and the e2e layer audit](implementation-plans/qe-u6-e2e-coverage/plan.md) | `test/qe-e2e-coverage` | QE-F10: the U6 manual-pass behaviors without an assertion (Header search, review paging and edit, lesson completion and a full quiz, admin dashboard and bell, transaction filter, avatar preview) covered; every e2e row classified for QE-F8, none moved. | QE-U4 component layer (PR 61); QE-U5 (PR 74). | Owner approval and implementation grant. |

## 5. Opening an initiative

1. Record the Owner-selected work in this program and verify it has one owner.
2. Main discovers current behavior and writes the next detail plan using the `program-docs` template; add its initiative row here.
3. Self-review with `code-review`; use independent plan and diff gates when risk or the Owner requires them. Permissions remain in `AGENTS.md` section 4.
4. Obtain plan approval and implementation authority before assigning the separate implementor session; maintain State in [progress.md](progress.md).
