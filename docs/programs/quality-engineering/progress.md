# Progress — quality-engineering

Charter: [README.md](README.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | QE-U1 plan r2, independent Codex plan gate PASS and Owner-approved on 2026-10-30. |
| Current unit / checkpoint | QE-U1 CP1-CP3 and E2E preflight corrections implemented locally. |
| Status | Main correction review and the independent implementation gate passed at d751f4e; no remaining Critical or Required findings. QE-F1 is fixed locally, awaiting PR CI and merge. |
| Completed evidence | Correction verification: full unit/RLS 248/248 twice consecutively (171 unit and 77 real local cases per run); E2E 60/60 twice consecutively, without reset; typecheck, zero-warning lint and docs checks pass. Five new real preflight regressions reject null/empty learner names, reassigned free/paid UI slugs and an occupied unknown-course ID before mutation acquisition, and verify unrelated rows remain unchanged after cleanup. Existing six ownership persistence probes, the real killed-coordinator recovery probe and journal subprocess regressions still pass. Historical CP3 evidence and docs checker tests 92/92 are in 5762f92; the checker is unchanged. Earlier CP3 HTTP lifecycle failures and the snapshot-reader race were corrected; affected journals were recovered explicitly after writers stopped, with no reset. Historical baseline/sandbox evidence remains in 54dc9fa; CP1/CP2 evidence remains in their milestones. |
| Accepted deviations | Comment UPDATE always advances updated_at, so mutable comment permission cases and the field-restoration probe use owned comments and verify the full seed comment stays unchanged. An earlier prototype advanced the local seed comment timestamp; original whole-session timestamp preservation is not claimed. No trigger/schema bypass was introduced. Dependency catalog checks block parent/account cleanup while foreign application dependents or unresolved acquired fields remain. These are bounded implementations of AC2, not product behavior changes. |
| Blockers / Owner decisions | none currently; readiness is rechecked on each acquisition. |
| Next action | Main records the review result, pushes the branch, opens the PR and waits for CI; merge only when all required checks pass and merge prerequisites hold. CI evidence belongs in the PR body. |
| Current authority | Owner granted r2 approval, local plan/program/transfers/PR #41 docs and implementation checkpoint/correction commits, the review-result State commit, push, PR creation and merge after green CI. No hosted authority; local writes/reset require the approved readiness checks. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-30 Quality Engineering opened, BL-F6/7/8 transferred to QE-F1/2/3, PR #41 documentation caught up; QE-U1 r2 approved after independent Codex PASS with plan/docs commit, separate-session implementation and local checkpoint commit grants (`b93f8a8`).
- 2026-10-30 QE-U1 implementor verified the clean assigned baseline and unit baseline; implementation paused at the approved readiness boundary because Docker is unavailable and exclusive disposable use is unproven (`54dc9fa`).
- 2026-10-30 QE-U1 CP1 adds shared target ownership, local readiness and managed-launcher coordination with subprocess regression checks (`5665df6`).
- 2026-10-30 QE-U1 CP1 loader correction resolves the preload path from the recorded checkout so Playwright's CommonJS transform does not encounter import.meta; full E2E passed 60/60 (`60020d1`).

- 2026-10-30 QE-U1 CP2 replaces E2E broad cleanup with scoped intents, exact-ID reconciliation and acquired fields; persistence/error probes and two full E2E runs pass (`14730fb`).
- 2026-10-30 QE-U1 CP3 migrates RLS fixtures, completes explicit recovery and handler/writer settlement, synchronizes journal snapshots with mutations and aligns safety docs; final repeated local suites pass, pending Main and independent final review (`5762f92`).
- 2026-10-30 QE-U1 E2E preflight rejects absent learner names, mismatched route/course IDs and an occupied unknown-course ID before acquisition; real preservation probes and repeated full local suites pass (`d751f4e`).
- 2026-10-30 QE-U1 implementation gate passed at `d751f4e` after both Required findings were resolved; independent verification used source/diff inspection and reused the supplied local runtime evidence. Linux CI and second-account behavior remain runtime-unverified; delivery is pending (this commit).
