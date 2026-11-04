# Progress — quality-engineering

Charter: [README.md](README.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | QE-U4 [`implementation-plans/qe-u4-component-tests/plan.md`](implementation-plans/qe-u4-component-tests/plan.md) r2 (2026-11-04; r1 kept every e2e row), self-reviewed, no Codex gate (dev dependencies and tests only; no auth, permission, schema or CI change); approved by the Owner on 2026-11-04. QE-U3 r4 closed. |
| Current unit / checkpoint | QE-U4 (component tests) on `test/qe-component-tests`: plan r2 approved; CP1 done locally (packages, `components` project, `CourseFormDialog` tests), CP2 and CP3 next. QE-U3 merged in PR #50 (`60c369a`) on 2026-11-02. |
| Status | CP1 verified locally: `components` project (jsdom) with 12 `CourseFormDialog` tests, 5.8 s wall for the project alone; `npm run test:unit` 585 passed, `npm test` 677 passed, `npm run test:e2e` 138 passed, `tsc`, lint (0), build clean, `npm audit` 18 (baseline 18). AC8 mutations all fail a test (removing the `savingRef` guard fails the duplicate-submit test; the slug, name and price rules, the price-error clearing, the `aria-invalid` bindings and the failed-save branch each fail at least one) and were reverted. Next: CP2 (move C2), CP3 (docs). The trial install of the five dev packages passed `tsc`, `build` and the unit tests at `8384545`. QE-F8 stays open after QE-U4 for the audit of every e2e row (Owner, 2026-11-04). QE-F2, QE-F3, QE-F4, QE-F7 and QE-F9 stay deferred. |
| Completed evidence | QE-U1: PR #42 (`ddcefd0`). QE-U2: PR #46 (`3e4b941`). QE-U3: PR #50 (`60c369a`), CI run 41430597719 green on head `b44ff15`; see milestones. |
| Accepted deviations | none. |
| Blockers / Owner decisions | none. |
| Next action | The implementor session implements CP2 and CP3 with a local commit per checkpoint (C2 deleted in its own commit); Main reviews each report and the real diff. |
| Current authority | Owner, 2026-11-04: QE-U4 r2 approved; commit of the PR 60 catch-up and the plan; implementation by one separate implementor session with local checkpoint commits, installing the five dev packages and running the test commands on the test stack. Push, PR and merge are not granted. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-30 Quality Engineering opened, BL-F6/7/8 transferred to QE-F1/2/3, PR #41 documentation caught up; QE-U1 r2 approved after independent Codex PASS with plan/docs commit, separate-session implementation and local checkpoint commit grants (`b93f8a8`).
- 2026-10-30 QE-U1 implementor verified the clean assigned baseline and unit baseline; implementation paused at the approved readiness boundary because Docker is unavailable and exclusive disposable use is unproven (`54dc9fa`).
- 2026-10-30 QE-U1 CP1 adds shared target ownership, local readiness and managed-launcher coordination with subprocess regression checks (`5665df6`).
- 2026-10-30 QE-U1 CP1 loader correction resolves the preload path from the recorded checkout so Playwright's CommonJS transform does not encounter import.meta; full E2E passed 60/60 (`60020d1`).

- 2026-10-30 QE-U1 CP2 replaces E2E broad cleanup with scoped intents, exact-ID reconciliation and acquired fields; persistence/error probes and two full E2E runs pass (`14730fb`).
- 2026-10-30 QE-U1 CP3 migrates RLS fixtures, completes explicit recovery and handler/writer settlement, synchronizes journal snapshots with mutations and aligns safety docs; final repeated local suites pass, pending Main and independent final review (`5762f92`).
- 2026-10-30 QE-U1 E2E preflight rejects absent learner names, mismatched route/course IDs and an occupied unknown-course ID before acquisition; real preservation probes and repeated full local suites pass (`d751f4e`).
- 2026-10-30 QE-U1 implementation gate passed at `d751f4e` after both Required findings were resolved; independent verification used source/diff inspection and reused the supplied local runtime evidence. Linux CI and second-account behavior remain runtime-unverified; delivery is pending (`65a35da`).

- 2026-10-30 QE-U1 fixture ownership, cleanup/recovery and preflight corrections delivered; QE-F1 closed, with later intermittent Windows observations retained separately in QE-P1 (PR 42, `ddcefd0`).
- 2026-11-01 QE-U2 r1 approved for QE-P1: bounded writer-exit wait before RLS teardown release and a measured `rls` test timeout (`e5062a5`).
- 2026-11-01 QE-U2 CP1 waits for registered writers before RLS teardown release (`c8f8be8`, correction `6a9895d`); CP2 sets the `rls` test timeout to 15 s from Windows measurements; QE-P1 fixed locally, awaiting delivery (`3194a0e`).
- 2026-11-01 QE-U2 merged: Windows RLS teardown waits for registered writers before release and `rls` has a measured 15 s timeout; QE-P1 resolved (PR 46, `3e4b941`).
- 2026-11-01 QE-U3 r4 approved for QE-P2 and QE-F5: separate test stack, lock with writer records, end-of-run audit (`038e334`).
- 2026-11-02 QE-U3 CP1 runs rls and e2e on a separate `devspace-test` stack beside the dev stack (`eba3051`); CP2 replaces the ownership journal with a machine-wide lock, writer records and an end-of-run audit (`02c89e2`); CP3 moves CI and the docs to the new commands; QE-P2 and QE-F5 fixed locally, awaiting delivery (`167646e`).
- 2026-11-02 QE-U3 merged after green CI: tests run on a separate `devspace-test` stack with one machine-wide lock and an end-of-run audit; QE-P2 resolved, QE-F5 done (PR 50, `60c369a`).
- 2026-11-04 QE-U4 r2 approved by the Owner: a `components` Vitest project in jsdom with Testing Library, `CourseFormDialog` tests, C2 moved on equivalent coverage, an e2e row kept only for an integration boundary; QE-F8 stays open for the e2e audit (`68fbde6`).
- 2026-11-04 QE-U4 CP1 adds the `components` Vitest project in jsdom with Testing Library, `npm run test:unit` runs it, and 12 `CourseFormDialog` tests cover AC2 to AC7 with the AC8 mutations failing (this commit).
