# Progress — security-engineering

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [SE-U1 plan](implementation-plans/se-u1-payment-write-integrity/plan.md) r3, approved by the Owner on 2026-11-07 after the Codex plan gate passed in round 4. |
| Current unit / checkpoint | SE-U1 CP2 (actions, schemas, modal and their tests) on `fix/se-u1-payment-write-integrity`, then CP3 on the stacked `fix/se-u1-payment-write-lock`. CP1 (M1 and `payments.test.ts`) is committed locally. |
| Status | Plan approved; CP1 implemented locally and awaiting Main review. No push, PR or hosted step. |
| Completed evidence | SE-U1 hosted catalog snapshot (Main, read-only, 2026-11-07) in plan section 2; Codex plan gate PASS on r3. SE-U4: milestones and PR #70. |
| Accepted deviations | None. |
| Hosted state | Hosted migration history ends at `20261106175756_se_u4_avatar_path_ownership`; `payments`, `coupons` and `enrollments` match the baseline (no `coupon_id`, no trigger, no `increment_coupon_usage`). No user data was read and nothing was written. |
| Blockers / Owner decisions | None for implementation. Delivery needs the separate push, PR, merge, hosted prepare/apply and D5 behavior-probe grants, at each gate of the plan runbook. |
| Next action | Implementor completes CP1–CP3 and reports; Main reviews each diff, then runs the Codex implementation gate. Outstanding Owner-requested work not yet scheduled: SE-F2 and SE-F3 in [future-features.md](future-features.md). |
| Current authority | Owner approved r3 (including D6) and granted the plan commit and implementation by one implementor session (2026-11-07): local checkpoint and correction commits, creating the stacked branch `fix/se-u1-payment-write-lock` for CP3, and the managed test stack. No push, PR, merge, hosted read of user data or hosted write is granted. |

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
- 2026-11-07 Owner approved SE-U4 r3 (SE-P4, SE-P5) after an independent Opus review and Codex PASS, and granted the plan commit and implementation (`299a1b1`)
- 2026-11-07 SE-U4 CP1 hid soft-deleted comments from every API role, required enrollment or admin for new comments, and moved soft delete to `soft_delete_comment`; community 47/47 with rollback/reapply and mutation checks (`154fd67`)
- 2026-11-07 SE-U4 CP2 limited non-admin `avatars` writes to the user's own folder, kept admin writes anywhere, moved the learner avatar upload to `<uid>/`; storage 13/13 with rollback/reapply, and the full local suites passed (`2d0f42a`)
- 2026-11-07 SE-U4 correction 1 made Storage test fixtures follow the shared unclean-run rules (a marked run or a timeout refuses the next writer) and clarified the avatars WITH CHECK comment (`937a7e7`)
- 2026-11-07 SE-U4 completed: deleted comments hidden from every API role, enrollment or admin required to comment, non-admin avatar writes limited to `<uid>/`; hosted migrations applied with catalog postflight, D8 behavior probes and Owner-confirmed production QA; SE-P4 and SE-P5 resolved (PR 70, b03a9b4)
- 2026-11-07 Owner approved SE-U1 r3 (SE-P8 to SE-P12; D2–D6) after Codex PASS, and granted the plan commit and implementation (`49e5dbb`)
- 2026-11-07 SE-U1 CP1 added M1 (`coupon_id`, one pending order per user and course, four payment functions, transition guard and delete release triggers) with its rollback; payments 37/37 and the full local suite 877/877 passed with a clean audit (this commit)
