# Progress — quality-engineering

Charter: [README.md](README.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [QE-U5](implementation-plans/qe-u5-flaky-harness/plan.md) r3 (2026-11-07), Codex plan gate PASS in round 3 (`gpt-6.1-sol`, high, read-only) at the Owner's request; approved by the Owner on 2026-11-07. |
| Current unit / checkpoint | QE-U5, CP1 not started. |
| Status | Plan approved and committed on `test/qe-flaky-harness`; implementation not started. QE-P5, QE-P7, QE-P8 and the remaining QE-F8 e2e audit are open. |
| Completed evidence | QE-U5 plan: `npm run docs:check` 0 violations; Codex plan review rounds 1 to 3 (PASS in round 3). |
| Accepted deviations | none. |
| Blockers / Owner decisions | none. Owner decisions 1 to 5 of 2026-11-07 are in the plan (section 1.4). |
| Next action | A separate implementor implements CP1 to CP4 with local checkpoint commits. |
| Current authority | Owner granted (2026-11-07) plan approval, this plan commit and implementation with local checkpoint commits. No push, PR or merge is granted. |

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
- 2026-11-04 QE-U4 CP1 adds the `components` Vitest project in jsdom with Testing Library, `npm run test:unit` runs it, and 12 `CourseFormDialog` tests cover AC2 to AC7 with the AC8 mutations failing (`b2d5b8b`).
- 2026-11-04 QE-U4 CP2 adds a component test that mirrors the steps of e2e row C2; mutating the slug rule, the price rule (whole number, sign) or the price-error clearing each fails it (`b8e0c3c`).
- 2026-11-04 QE-U4 CP2 deletes e2e row C2 from `admin-content-forms.spec.ts` after its mutations failed the component test; `C2 -> __tests__/unit/components/CourseFormDialog.test.tsx` (`45ad9f0`).
- 2026-11-04 QE-U4 CP3: `test-quality-strategy` gets the component layer and the e2e integration-boundary rule with the C2 mapping, the app-foundation invariant is replaced by decision 5, `dependency-updates` and `AGENTS.md` follow, AF-P6 resolved; QE-F8 stays open for the e2e audit (`35cc3c4`).
- 2026-11-04 QE-U4 correction after Main review: State rewritten to the final counts and mutation results, and `AGENTS.md` says `npm test` runs every project (`334ba8a`).
- 2026-11-04 QE-U4 correction 2 (Owner): the component test that replayed all of C2 is removed, C2 is mapped per assertion to the focused tests, and `test-quality-strategy` says to reuse focused tests when an e2e row moves; the three AC12 mutations still fail focused tests (`2a205b1`).
- 2026-11-04 QE-U4 merged after green CI (run 41818417236): a `components` Vitest project in jsdom with Testing Library, `CourseFormDialog` component tests, e2e row C2 moved and the e2e integration-boundary rule; AF-P6 resolved, QE-F8 open for the e2e audit (PR 61, `78c80ba`).
- 2026-11-05 Small task QE-P6: staged verification and risk-based repeatability checks replace automatic double full runs; lifecycle, review and commit guidance synchronized, fixed locally and awaiting delivery (`f1d7ff5`).
- 2026-11-05 Audit follow-up makes the Owner-confirmed Prettier-only local verification exception explicit in the test-selection owner and its dependency consumer (`fd4e650`).
- 2026-11-05 QE-P6 merged with the staged test policy, risk-based repeats and the Prettier-only local verification exception (PR 67, `3d21627`).
- 2026-11-07 QE-U5 r3 approved by the Owner after the Codex plan gate passed in round 3: QE-P8 admission and hook-abort guards, diagnostics-first focused investigation of QE-P5 and QE-P7, SE-U1 and PR 73 docs catch-up (this commit).
