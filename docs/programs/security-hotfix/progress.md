# Progress — Security hotfix

Plans: [H1](plan.md), [H2](plan-h2.md), [SH-P3 community write integrity](implementation-plans/sh-p3-community-write-integrity/plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | H1/H2 historical plans remain approved. The Owner approved H2-2a and all 32 legacy problem conversions on 2026-10-31, then selected separate entry-plan placement: `implementation-plans/sh-p3-community-write-integrity/plan.md` r2. Independent review of the actual relocated plan/documentation diff passed with no Critical or Required findings. |
| Current unit / checkpoint | H2-2a documentation preparation: canonical SH-P1-SH-P32 records/mappings and the SH-P3 entry plan; CP1 database implementation has not begun. H2-2b remains deferred. |
| Status | H1 and H2-1 shipped. Canonical documentation conversion is fixed locally awaiting delivery (SH-P32); SH-P3/SH-P4 remain open and planned. No migration or product change has been made. |
| Completed evidence | Documentation preparation: all 32 legacy records have unique canonical mappings; scope/severity/discovery scheduling preserved; six closed records cite merged delivery evidence. Docs checks, 94/94 checker tests outside the sandbox, typecheck and zero-warning lint passed; historical H1/H2 plans, AW-U10 and published SQL match ddcefd0. No database/product verification has run. Historical delivery: H1 PR #2 (2026-10-21); H2-1 PR #3/#4 and migration B `20261021185249`, with the 2026-10-22 production matrix in `plan-h2.md` section 6; 17g failed on legacy P16 (now SH-P16), 17i was skipped. |
| Accepted deviations | The Owner selected a canonical problem entry with a separate detail plan after plan-only commit 284da8a. The correction restores the historical H2 plan by removing only the superseded Appendix B and prepares HA6 documentation before CP1; approved product behavior is unchanged. |
| Blockers / Owner decisions | The Owner confirmed on 2026-10-31 that devspace-local at 127.0.0.1:54322 contains only disposable test data and may be reset; target identity and exclusive use must still be rechecked immediately before mutation. Main's correction-plan commit precedes continuation through CP1/CP2. H2-2b and a future Security Engineering evergreen program remain outside this task. |
| Next action | Main commits the reviewed corrected plan/documents, then resumes the same implementor for all remaining CP1/CP2 work and local checkpoint commits; do not pause after each checkpoint unless a real blocker or new Owner decision arises. |
| Current authority | Owner grants (2026-10-31): plan-first commit, H2-2a implementation and local checkpoint/correction commits; independent Codex chats authorized. The current step is documentation preparation only: the implementor must not stage/commit, write/reset local application data or create a migration before Main's correction-plan commit and explicit continuation. No push, PR creation/update, merge, hosted prepare/apply or hosted application-data write grant. |
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
- 2026-10-31 Owner approved H2-2a and the full traceable legacy-problem conversion, with a plan commit first and local implementation checkpoint commits; Appendix B records the approved execution scope (`284da8a`).
- 2026-10-31 Owner selected separate SH-P3 entry-plan placement; the correction prepares 32 canonical problem records and mappings, with SH-P32 fixed locally awaiting delivery and SH-P3/SH-P4 still planned (this commit).
