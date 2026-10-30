# Progress — quality-engineering

Charter: [README.md](README.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | QE-U1 plan r2, independent Codex plan gate PASS and Owner-approved on 2026-10-30. |
| Current unit / checkpoint | QE-U1 CP1-CP3 implemented locally. |
| Status | Automated checks passed; awaiting Main review and the independent final implementation gate. QE-F1 is fixed locally, awaiting delivery. |
| Completed evidence | Final unit 171/171; full unit/RLS 243/243 twice consecutively (72 real local cases per run); E2E 60/60 twice consecutively, without reset. Six ownership persistence probes include failed preflight, lost row/Auth responses, precise field restoration, foreign-dependent cascade preservation and real Auth lookup failure; the separate real lifecycle probe verifies killed-coordinator recovery. Journal regressions cover a deterministic writer barrier, 1,500 cross-process publication/removal cycles, interrupted artifacts and corrupt published JSON. Typecheck, zero-warning lint, docs checks and docs checker tests 92/92 pass. Earlier CP3 HTTP lifecycle failures and the snapshot-reader race were corrected; affected journals were recovered explicitly after writers stopped, with no reset. Historical baseline/sandbox evidence remains in 54dc9fa; CP1/CP2 evidence remains in their milestones. |
| Accepted deviations | Comment UPDATE always advances updated_at, so mutable comment permission cases and the field-restoration probe use owned comments and verify the full seed comment stays unchanged. An earlier prototype advanced the local seed comment timestamp; original whole-session timestamp preservation is not claimed. No trigger/schema bypass was introduced. Dependency catalog checks block parent/account cleanup while foreign application dependents or unresolved acquired fields remain. These are bounded implementations of AC2, not product behavior changes. |
| Blockers / Owner decisions | none currently; readiness is rechecked on each acquisition. |
| Next action | Main reviews the final local candidate and routes any corrections to the same implementor, then runs the independent final diff gate before an Owner delivery decision. |
| Current authority | Owner granted r2 approval, a local plan/program/transfers/PR #41 docs commit, separate-session implementation and local implementation checkpoint/correction commits. No push, PR, merge or hosted authority; local writes/reset require the approved readiness checks. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-30 Quality Engineering opened, BL-F6/7/8 transferred to QE-F1/2/3, PR #41 documentation caught up; QE-U1 r2 approved after independent Codex PASS with plan/docs commit, separate-session implementation and local checkpoint commit grants (`b93f8a8`).
- 2026-10-30 QE-U1 implementor verified the clean assigned baseline and unit baseline; implementation paused at the approved readiness boundary because Docker is unavailable and exclusive disposable use is unproven (`54dc9fa`).
- 2026-10-30 QE-U1 CP1 adds shared target ownership, local readiness and managed-launcher coordination with subprocess regression checks (`5665df6`).
- 2026-10-30 QE-U1 CP1 loader correction resolves the preload path from the recorded checkout so Playwright's CommonJS transform does not encounter import.meta; full E2E passed 60/60 (`60020d1`).

- 2026-10-30 QE-U1 CP2 replaces E2E broad cleanup with scoped intents, exact-ID reconciliation and acquired fields; persistence/error probes and two full E2E runs pass (`14730fb`).
- 2026-10-30 QE-U1 CP3 migrates RLS fixtures, completes explicit recovery and handler/writer settlement, synchronizes journal snapshots with mutations and aligns safety docs; final repeated local suites pass, pending Main and independent final review (this commit).
