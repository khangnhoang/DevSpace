# Progress — Security hotfix

Plans: [H1](plan.md), [H2](plan-h2.md), [SH-P3 community write integrity](implementation-plans/sh-p3-community-write-integrity/plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | H1/H2 historical plans remain approved. The Owner approved H2-2a and all 32 legacy problem conversions on 2026-10-31, then selected separate entry-plan placement: `implementation-plans/sh-p3-community-write-integrity/plan.md` r2. Independent review of the actual relocated plan/documentation diff passed with no Critical or Required findings. |
| Current unit / checkpoint | H2-2a CP1 and CP2 locally complete, awaiting Main and fresh independent implementation review. CP1: 1aa583f; canonical conversion/entry-plan preparation: bed90f6. H2-2b remains deferred. |
| Status | SH-P3/SH-P4 fixed locally awaiting delivery. SH-P32 remains fixed locally awaiting delivery. Local checks passed; Main and fresh independent implementation review remain pending. H1/H2-1 delivery is historical; production H2-2a is not fixed. |
| Completed evidence | CP1 (1aa583f): local migration 20261031073938 replayed; exact rollback/reapply catalog comparisons passed (including absent comment WITH CHECK, original policies/roles, trigger/helper removal, grants and RLS). Community regression: 20/20 passed, including owner/admin JWT/service_role denials and trigger ACL checks. Two consecutive default npm test commands passed 261/261 in 22 files each with exit 0, without an intervening reset/recovery; all 14 public tables were exactly unchanged after each and ownership released normally. Typecheck, zero-warning lint, safe placeholder-env build, docs checks and 94/94 checker tests passed. Earlier attempts: 83/261 assertions failed after a 5000 ms preflight timeout, then 261/261 passed but teardown exited 1 with live-writer ownership retained; exact-run recovery followed each failure. QE-P1 records those observations; passing retries do not establish a QE harness fix. HA6 preserves all 32 mappings and historical H1/H2/AW-U10/published SQL. |
| Accepted deviations | The Owner selected a canonical problem entry with a separate detail plan after plan-only commit 284da8a. The correction restores the historical H2 plan by removing only the superseded Appendix B and prepares HA6 documentation before CP1; approved product behavior is unchanged. |
| Blockers / Owner decisions | No remaining local acceptance blocker after two consecutive default runs passed. [QE-P1](../quality-engineering/problems.md#qe-p1-windows-full-suite-lifecycle-can-retain-ownership-after-completion) retains unrelated intermittent lifecycle/timing observations for Owner/Main follow-up; no root cause is confirmed, no harness change or weakened guard is included. Local disposable-data approval was used only after QE-U1 target/exclusive checks. H2-2b and a future Security Engineering evergreen program remain outside this task. |
| Next action | Main inspects the complete diff/commits and commissions fresh independent implementation review. Remote delivery and hosted prepare/apply/postflight require their applicable separate grants and green CI. |
| Current authority | Owner grants (2026-10-31): approved entry plan committed first in bed90f6, implement all CP1/CP2 and make local checkpoint/correction commits after verification/self-review; independent chats authorized. No push, PR creation/update, merge, hosted prepare/apply or hosted application-data write grant. |
| Hosted state | H1 migration `20261021131351` and H2-1 migrations `20261021181051` (A) and `20261021185249` (B) remain the supplied hosted state of `lkvxxrxojjlkchzzqidu`. H2-2a migration 20261031073938 exists and was applied only locally; no hosted step was run. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-21 H1 plan written and approved after Codex plan review PASS in round 4 (`1b7215f`).
- 2026-10-21 H1 shipped: role escalation blocked, session moved to cookies, server actions and the admin layout guarded (PR 2, `5c842d4`).
- 2026-10-22 H2 plan written and approved after Codex plan review PASS in round 4 (`4f6d4eb`).
- 2026-10-22 H2-1 code and migrations A and B merged: profile PII, public coupons and paid lesson/quiz content closed (PR 3, `36056ec`).
- 2026-10-22 H2-1 migration B file renamed to its recorded version (PR 4, `5ae5943`).
- 2026-10-22 H2-1 production matrix recorded and the Owner deferred H2-2, split into H2-2a (P3, P4) and H2-2b (P5/P6, P25) (`6e8e1b7`).
- 2026-10-24 `infrastructure` U5 merged: the payment-flow tests H2-2b waited for, with P5, P6 and P25 as known bugs (PR 18, `b8e3e0f`).
- 2026-10-29 P21 resolved: the nine `window.confirm` calls became `ConfirmDialog` in app-foundation U1 (PR 38).
- 2026-10-31 Owner approved H2-2a and the full traceable legacy-problem conversion, with a plan commit first and local implementation checkpoint commits; Appendix B records the approved execution scope (`284da8a`).
- 2026-10-31 Owner selected separate SH-P3 entry-plan placement; the correction prepares 32 canonical problem records and mappings, with SH-P32 fixed locally awaiting delivery and SH-P3/SH-P4 still planned (`bed90f6`).
- 2026-10-31 H2-2a community write integrity implemented locally with exact rollback/reapply, 20 actor/catalog regressions and two consecutive 261-test default runs; seed unchanged, intermittent test failures retained for QE follow-up, delivery/hosted verification pending (`1aa583f`).
- 2026-10-31 H2-2a final documentation reconciled: 32 legacy mappings retained, SH-P3/SH-P4/SH-P32 fixed locally awaiting delivery, unrelated QE-P1 recorded; independent implementation review and hosted rollout pending (this commit).
