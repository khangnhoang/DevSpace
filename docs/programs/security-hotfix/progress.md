# Progress — Security hotfix

Plan: `plan.md` (H1) and `plan-h2.md` (H2). Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | H1/H2 historical plans remain approved. The Owner approved H2-2a execution addendum r1 in `plan-h2.md` Appendix B on 2026-10-31, including the full legacy problem conversion; independent review of the materialized plan diff passed with no Critical or Required findings. |
| Current unit / checkpoint | H2-2a plan preparation; implementor stopped pending the plan commit. H2-2b remains deferred. |
| Status | H1 and H2-1 shipped. H2-2a approved for local implementation after the plan commit; no migration or product change has been made. |
| Completed evidence | H1: PR #2, merged 2026-10-21. H2-1: PR #3 and #4, merged and deployed, migration B `20261021185249` applied, matrix run on production with the results in `plan-h2.md` section 6 (historical, 2026-10-22). Open from that run: 17g fails on the old bug P16 and 17i was skipped. |
| Accepted deviations | none |
| Blockers / Owner decisions | The Owner authorized canonical conversion of all 32 legacy problem records, including closed declarations, preserving provenance, content and status. Before local mutation the implementor must establish exclusive/disposable readiness; Docker running alone is insufficient. H2-2b remains out of scope. |
| Next action | Commit the reviewed approved plan, then resume the same implementor for CP1/CP2 and local checkpoint commits; Main and independent implementation review follow. |
| Current authority | Owner grants (2026-10-31): commit the approved plan first, implement H2-2a and make local checkpoint/correction commits; independent Codex chats authorized. No push, PR creation/update, merge, hosted prepare/apply or hosted application-data write grant. |
| Hosted state | H1 migration `20261021131351` and H2-1 migrations `20261021181051` (A) and `20261021185249` (B) are applied to `lkvxxrxojjlkchzzqidu`. The H2-2 migration is not written and not applied. |

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
- 2026-10-31 Owner approved H2-2a and the full traceable legacy-problem conversion, with a plan commit first and local implementation checkpoint commits; Appendix B records the approved execution scope (this commit).
