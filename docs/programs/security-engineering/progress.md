# Progress — security-engineering

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [SE-U2 plan](implementation-plans/se-u2-password-recovery/plan.md) r2, approved by the Owner on 2026-11-05. |
| Current unit / checkpoint | SE-U2, CP3 recovery form security on `fix/se-p1-password-recovery`. |
| Status | CP1 and CP2 complete locally. CP3 implementation and final regression are pending. SE-P1 remains open. |
| Completed evidence | CP1 isolated GoTrue v2.197.0 enforcement, genuine email/PKCE recovery, persistence and cleanup passed via `scripts/auth/password-enforcement-probe.mjs`. CP2 proved explicit loopback Mailpit, local SMTP, relative callback, verified recovery across reload and exact cleanup on controlled failure. Auth E2E passed 18/18 after reset and its retained-stack repeat passed 4/4 without reset. Callback/allowlist units passed 20/20, test stack config/identity/reset/mail units 24/24 and lifecycle units 30/30. Earlier failed runs remain in the implementor reports. |
| Accepted deviations | The opening plan moved SH-P23 to ui-ux as UX-F4; it moved as UX-P3 (a problem) because `npm run docs:check` forbids a mapping that changes kind (problem to feature), Main-approved 2026-11-05. Main also adjudicated on 2026-11-05 that confirmed NextURL loopback normalization requires a narrow relative-Location callback correction during CP2 before CP3; r2 acceptance, safe-next allowlist and permissions stay unchanged. |
| Blockers / Owner decisions | None for local implementation. Hosted preflight, apply and designated-account verification require separate grants. |
| Next action | The assigned implementor binds reset submission to verified recovery and completes the final regression. |
| Current authority | Owner granted implementation and local checkpoint commits (direct message 2026-11-05). Scope covers the managed local test stack and isolated disposable local Auth/database/mail probe in r2. No push, PR, merge, deploy, hosted access or manual dev database writes are granted. |
| Hosted state | Settings and runtime version unverified; hosted rollout and designated-account verification pending separate grants. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-11-05 Program opened (ADR 0007): charter, 22 security entries moved from `security-hotfix` and the backlog, H2-2b as SE-U1 (`4249815`).
- 2026-11-05 Small task SE-P2 with backlog BL-P6: the activation mail escapes the learner name, course name and link (`lib/activation-email.ts`), and its fallback link opens `/course/<slug>`; unit-tested (PR 66, `b6f1902`).
- 2026-11-05 Owner approved SE-U2 r2 after independent plan review and authorized the plan/docs commit and separate-session implementation, including local Mailpit for genuine recovery E2E (`d6e8bcd`).
- 2026-11-05 SE-U2 CP1 proved native current-password enforcement with fresh ordinary sessions and genuine email/PKCE recovery on disposable local resources; persistence and owned cleanup passed (`408520d`).
- 2026-11-05 SE-U2 CP2 verified genuine browser recovery and reload with loopback-only Mailpit, same-origin callback and exact fixture cleanup across reset and retained test stack runs (this commit).
