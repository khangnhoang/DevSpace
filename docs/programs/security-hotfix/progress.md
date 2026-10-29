# Progress — Security hotfix

Plan: `plan.md` (H1) and `plan-h2.md` (H2). Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | H1: `plan.md`, approved. H2: `plan-h2.md`, approved. Both passed Codex plan review in round 4 (`gpt-6.1-sol`, high, read-only). |
| Current unit / checkpoint | none active. H2-2a and H2-2b are deferred. |
| Status | H1 and H2-1 shipped. H2-2 deferred by the Owner on 2026-10-22. |
| Completed evidence | H1: PR #2, merged 2026-10-21. H2-1: PR #3 and #4, merged and deployed, migration B `20261021185249` applied, matrix run on production with the results in `plan-h2.md` section 6 (historical, 2026-10-22). Open from that run: 17g fails on the old bug P16 and 17i was skipped. |
| Accepted deviations | none |
| Blockers / Owner decisions | H2-2a (P3 and P4: review policy, comment `with_check` and trigger) is small and low risk; do it when work returns to security. H2-2b (P5/P6 and P25: 3 RPCs, `payments_guard`, deploy order, rollback) now has its payment-flow tests: `infrastructure` U5 merged, with P5, P6 and P25 as known bugs in `__tests__/e2e/payment-*.spec.ts` (rows K4 to K8). The Owner put agent-workflow and infrastructure (an isolated environment and GitHub Actions) first because manual testing on production is too heavy. |
| Next action | the Owner decides when to start H2-2a or H2-2b. |
| Current authority | none: no unit is active, so nothing is permitted here beyond reading. H2-2 needs a new grant from the Owner, and applying any migration to the hosted database is a separate grant. |
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
