# Progress — security-engineering

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [SE-U2 plan](implementation-plans/se-u2-password-recovery/plan.md) r2, approved by the Owner on 2026-11-05. |
| Current unit / checkpoint | SE-U2, CP1 native Auth enforcement proof on `fix/se-p1-password-recovery`. |
| Status | Plan approved; preparing the separate implementor assignment for CP1 through CP3. SE-P1 remains open pending implementation and hosted verification. |
| Completed evidence | Independent plan review passed on r2 (`ecf0c36b` file hash before the approval metadata update); local `docs:check` and whitespace checks passed. Runtime enforcement, Mailpit readiness and hosted settings are unverified. |
| Accepted deviations | The opening plan moved SH-P23 to ui-ux as UX-F4; it moved as UX-P3 (a problem) because `npm run docs:check` forbids a mapping that changes kind (problem to feature). Main-approved 2026-11-05. |
| Blockers / Owner decisions | none. |
| Next action | Main commits the approved plan and assigns CP1 through CP3 to one separate implementor session. |
| Current authority | Owner granted the plan/docs commit and implementation on 2026-11-05. Implementation covers the managed local test stack and isolated disposable local Auth/database/mail probe described in the plan. The implementor reports uncommitted checkpoints to Main. Further commits, push, PR, merge, hosted access and manual dev database writes require their own grants. |
| Hosted state | Settings and runtime version unverified; hosted rollout and designated-account verification pending separate grants. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-11-05 Program opened (ADR 0007): charter, 22 security entries moved from `security-hotfix` and the backlog, H2-2b as SE-U1 (`4249815`).
- 2026-11-05 Small task SE-P2 with backlog BL-P6: the activation mail escapes the learner name, course name and link (`lib/activation-email.ts`), and its fallback link opens `/course/<slug>`; unit-tested (PR 66, `b6f1902`).
- 2026-11-05 Owner approved SE-U2 r2 after independent plan review and authorized the plan/docs commit and separate-session implementation, including local Mailpit for genuine recovery E2E (this commit).
