# Progress — security-engineering

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [SE-U2 plan](implementation-plans/se-u2-password-recovery/plan.md) r2, approved by the Owner on 2026-11-05. |
| Current unit / checkpoint | SE-U2, CP2 managed Mailpit/browser readiness on `fix/se-p1-password-recovery`. |
| Status | CP1 complete; CP2 browser gate failed after runner-owned loopback/SMTP readiness passed. Callback origin and cleanup diagnostics are being confirmed; CP3 has not started. SE-P1 remains open. |
| Completed evidence | CP1 isolated GoTrue v2.197.0 enforcement, genuine email/PKCE recovery, persistence and cleanup passed via `scripts/auth/password-enforcement-probe.mjs`; reused because CP2 changes do not affect the independent probe. R1 static/focused checks passed; its full unit run failed a sandbox socket check and was interrupted, then that focused file passed 23/23 with approved socket access. R2 measured the effective bind failure and confirmed managed test stack cleanup. Detailed evidence stays in the implementor reports; hosted settings remain unverified. |
| Accepted deviations | The opening plan moved SH-P23 to ui-ux as UX-F4; it moved as UX-P3 (a problem) because `npm run docs:check` forbids a mapping that changes kind (problem to feature). Main-approved 2026-11-05. |
| Blockers / Owner decisions | Genuine recovery navigation changed from 127.0.0.1:3100 to localhost:3100 and did not show the reset form. The first mailbox cleanup also marked the run unclean; 14 later scenarios refused acquisition. CP2 cannot pass until the callback boundary is resolved without bypassing it. |
| Next action | The assigned implementor diagnoses the first browser result and proves all CP2 gates before implementing CP3. |
| Current authority | Owner granted implementation and local checkpoint commits (direct message 2026-11-05). Scope covers the managed local test stack and isolated disposable local Auth/database/mail probe in r2. No push, PR, merge, deploy, hosted access or manual dev database writes are granted. |
| Hosted state | Settings and runtime version unverified; hosted rollout and designated-account verification pending separate grants. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-11-05 Program opened (ADR 0007): charter, 22 security entries moved from `security-hotfix` and the backlog, H2-2b as SE-U1 (`4249815`).
- 2026-11-05 Small task SE-P2 with backlog BL-P6: the activation mail escapes the learner name, course name and link (`lib/activation-email.ts`), and its fallback link opens `/course/<slug>`; unit-tested (PR 66, `b6f1902`).
- 2026-11-05 Owner approved SE-U2 r2 after independent plan review and authorized the plan/docs commit and separate-session implementation, including local Mailpit for genuine recovery E2E (`d6e8bcd`).
- 2026-11-05 SE-U2 CP1 proved native current-password enforcement with fresh ordinary sessions and genuine email/PKCE recovery on disposable local resources; persistence and owned cleanup passed (this commit).
