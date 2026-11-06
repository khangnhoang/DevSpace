# Progress — security-engineering

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | SE-U3 r3 delivered in PR #69. No SE-U4 plan is committed yet. |
| Current unit / checkpoint | SE-U3 completed. SE-U4 (SE-P4, SE-P5) is being planned on `fix/se-u4-comment-avatar-integrity`; its plan is not yet approved or committed. |
| Status | SE-U3 is completed (PR #69, Owner-confirmed hosted acceptance and production QA on 2026-11-07); SE-P3, SE-P6 and SE-P7 are resolved. |
| Completed evidence | SE-U3: milestones and PR #69. |
| Accepted deviations | None. |
| Hosted state | Hosted migration history lists every repository migration through `20261106100209` (Main, read-only, 2026-11-06). No user data was read and nothing was written. |
| Blockers / Owner decisions | SE-U4 plan approval, plan commit and implementation grant, each a separate Owner decision. |
| Next action | Owner reviews the SE-U4 plan summary. |
| Current authority | Owner granted this local docs commit only. No push, PR, merge, hosted user-data read or hosted write is granted. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-11-05 Program opened (ADR 0007): charter, 22 security entries moved from `security-hotfix` and the backlog, H2-2b as SE-U1 (`4249815`).
- 2026-11-05 Small task SE-P2 with backlog BL-P6: the activation mail escapes the learner name, course name and link (`lib/activation-email.ts`), and its fallback link opens `/course/<slug>`; unit-tested (PR 66, `b6f1902`).
- 2026-11-05 Owner approved SE-U2 r2 after independent plan review and authorized the plan/docs commit and separate-session implementation, including local Mailpit for genuine recovery E2E (`d6e8bcd`).
- 2026-11-05 SE-U2 CP1 proved native current-password enforcement with fresh ordinary sessions and genuine email/PKCE recovery on disposable local resources; persistence and owned cleanup passed (`408520d`).
- 2026-11-05 SE-U2 CP2 verified genuine browser recovery and reload with loopback-only Mailpit, same-origin callback and exact fixture cleanup across reset and retained test stack runs (`071ee81`).
- 2026-11-05 SE-U2 CP3 bound the reset form and password update to the verified recovery session, added genuine Auth regressions and recorded hosted rollout order. The full local suites passed (`c12b096`).
- 2026-11-05 SE-U2 suppressed sensitive recovery test diagnostics and enforced verified live Mailpit and Auth network attachments. The full local suites passed (`7aad69d`).
- 2026-11-06 SE-U2 prevented recovery failure snapshots from retaining sensitive input, with synthetic attachment scans and genuine recovery and full browser regression passing locally (`45fa3d96`).
- 2026-11-06 SE-U2 delivered with the native current-password requirement enabled by the Owner and production recovery accepted before and after deployment; SE-P1 resolved (PR 68, 749927bb).
- 2026-11-06 Owner approved independently reviewed SE-U3 r2 as one PR, including the PR #68 catch-up, and authorized the plan/docs commit, separate-session implementation and local checkpoint/correction commits (`afda0d2`).
- 2026-11-06 SE-U3 CP1 added M1 email/identity protection and client INSERT restriction; focused profiles, individual rollback/reapply, signup and browser profile/admin compatibility passed locally with clean managed audits; hosted acceptance remains pending (`59806b9`).
- 2026-11-06 SE-U3 CP2 added M2 validated role membership and NOT NULL with unchanged user default; profiles passed 36/36 after reset and 36/36 retained with clean audit, including privileged constraints and invalid-existing-data refusal/rollback (`8ce57d0`).
- 2026-11-06 SE-U3 CP3 added dependency-checked GraphQL removal and exact 1.5.11 rollback proof; combined rollback/reapply and partial-prefix checks passed. Final local Vitest 779/779 and E2E 149/149 passed with clean audits; r3 and independent/hosted gates remained pending (`314ccdf`).
- 2026-11-06 SE-U3 moved compatibility ownership to machine-wide shared recovery and stop/audit boundaries, with exact identity refusal and interruption regressions; Vitest 795/795 and E2E 149/149 passed with clean audits. Independently reviewed r3 is included; implementation re-review and hosted gates remained pending (`52c3556`).
- 2026-11-07 SE-U3 completed: profile email/identity protection, non-null user/admin roles and unused GraphQL removal delivered with Owner-confirmed hosted acceptance and production QA; SE-P3, SE-P6 and SE-P7 resolved (PR 69, e76cc05)
