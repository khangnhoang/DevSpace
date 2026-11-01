# Progress — quality-engineering

Charter: [README.md](README.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | QE-U3 `implementation-plans/qe-u3-test-stack/plan.md` r4 (2026-11-01); r1 to r3 failed the Codex plan gate, r4 passed it and was approved by the Owner on 2026-11-01. QE-U2 r1 closed. |
| Current unit / checkpoint | QE-U3 CP1 (`eba3051`, accepted by Main) and CP2 (machine-wide lock, writer records, end-of-run audit, in-memory fixture ownership; old journal and recovery removed) implemented on `test/qe-p2-test-stack`; CP2 awaits Main review. CP3 (CI, docs, skills) not started. |
| Status | QE-U2 delivered in PR #46 (`3e4b941`); QE-P2 open; QE-F5 transferred from BL-F3 and BL-F5 transferred as QE-F6 and consolidated into QE-F4 (2026-11-01). |
| Completed evidence | QE-U1: PR #42 (`ddcefd0`). QE-U2: PR #46 (`3e4b941`); see milestones. |
| Accepted deviations | none. |
| Blockers / Owner decisions | none. |
| Next action | Main reviews CP2; then the implementor starts CP3. |
| Current authority | 2026-11-02: QE-U3 r4 implementation by a separate implementor with local checkpoint commits; Main reviews each checkpoint; no push or PR. |

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
- 2026-11-01 QE-U3 r4 approved for QE-P2 and QE-F5: separate test stack, lock with writer records, end-of-run audit (this commit).
