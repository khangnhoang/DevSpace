# Progress — security-engineering

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [SE-U2 plan](implementation-plans/se-u2-password-recovery/plan.md) r2, approved by the Owner on 2026-11-05. |
| Current unit / checkpoint | SE-U2, CP3 recovery form security on `fix/se-p1-password-recovery`. |
| Status | CP1–CP3 complete locally. Independent implementation review and manual QA are pending. SE-P1 remains open. |
| Completed evidence | CP1 proved native enforcement, genuine email/PKCE recovery, password persistence and cleanup on disposable GoTrue v2.197.0. CP2 proved loopback-only Mailpit, local SMTP, a same-origin callback, recovery across reload and exact cleanup on controlled failure. Auth E2E passed 18/18 after reset and 4/4 on the retained-stack repeat. The locked missing-mailbox probe stopped before running tests after `ECONNRESET`; the next managed launch restarted and reset the test stack. CP3 focused auth E2E passed 23/23, targeted auth units passed 57/57, full Vitest passed 750/750 and full Playwright passed 149/149. Earlier failed runs remain in the implementor reports. |
| Accepted deviations | The opening plan moved SH-P23 to ui-ux as UX-F4; it moved as UX-P3 (a problem) because `npm run docs:check` forbids a mapping that changes kind (problem to feature), Main-approved 2026-11-05. Main also adjudicated on 2026-11-05 that confirmed NextURL loopback normalization requires a narrow relative-Location callback correction during CP2 before CP3; r2 acceptance, safe-next allowlist and permissions stay unchanged. |
| Blockers / Owner decisions | Hosted preflight, apply and designated-account verification require separate grants. |
| Next action | Main validates the exact local candidate, obtains independent implementation review, and performs responsive and keyboard QA before the separately authorized rollout steps. |
| Current authority | Owner granted implementation and local checkpoint commits (direct message 2026-11-05). Scope covers the managed local test stack and isolated disposable local Auth/database/mail probe in r2. No push, PR, merge, deploy, hosted access or manual dev database writes are granted. |
| Hosted state | Settings and runtime version unverified; hosted rollout and designated-account verification pending separate grants. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-11-05 Program opened (ADR 0007): charter, 22 security entries moved from `security-hotfix` and the backlog, H2-2b as SE-U1 (`4249815`).
- 2026-11-05 Small task SE-P2 with backlog BL-P6: the activation mail escapes the learner name, course name and link (`lib/activation-email.ts`), and its fallback link opens `/course/<slug>`; unit-tested (PR 66, `b6f1902`).
- 2026-11-05 Owner approved SE-U2 r2 after independent plan review and authorized the plan/docs commit and separate-session implementation, including local Mailpit for genuine recovery E2E (`d6e8bcd`).
- 2026-11-05 SE-U2 CP1 proved native current-password enforcement with fresh ordinary sessions and genuine email/PKCE recovery on disposable local resources; persistence and owned cleanup passed (`408520d`).
- 2026-11-05 SE-U2 CP2 verified genuine browser recovery and reload with loopback-only Mailpit, same-origin callback and exact fixture cleanup across reset and retained test stack runs (`071ee81`).
- 2026-11-05 SE-U2 CP3 bound the reset form and password update to the verified recovery session, added genuine Auth regressions and recorded hosted rollout order. The full local suites passed (this commit).
