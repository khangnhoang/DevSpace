# Progress — security-engineering

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [SE-U4 plan](implementation-plans/se-u4-comment-avatar-integrity/plan.md) r3, approved by the Owner on 2026-11-07 after the independent Opus review of r1 and Codex PASS on r3. |
| Current unit / checkpoint | SE-U4 implementation complete locally on `fix/se-u4-comment-avatar-integrity`: CP1 comment integrity `154fd67`, CP2 avatar path ownership `2d0f42a`, correction 1 `937a7e7`. |
| Status | Main review passed with no Critical or Required; the Codex implementation gate passed in round 3 (round 1 Required fixed in `937a7e7`; the round 2 timeout findings were withdrawn as pre-existing harness limits, recorded as quality-engineering QE-P8). No push, PR or hosted step. |
| Completed evidence | SE-U4 final local regression: `npm test` 835/835, `npm run test:e2e` 149/149, `tsc`, lint, build, docs check; community 47/47 and storage 13/13 (storage also on the retained stack). Hosted untouched. SE-U3: milestones and PR #69. |
| Accepted deviations | None. |
| Hosted state | SE-U4 baseline (Main, read-only catalog, 2026-11-06/07): `comments` policies and triggers and the `avatars` bucket and policies match the repository; no view, function body or publication references `comments`; `storage.objects` is owned by `supabase_storage_admin`, and `supautils.policy_grants` lets `postgres` manage its policies. No user data was read and nothing was written. |
| Blockers / Owner decisions | None for implementation. Delivery needs the separate push, PR, merge, hosted prepare/apply and D8 behavior-probe grants. |
| Next action | Owner decides delivery: push and PR, then CI, merge, hosted prepare/apply and the D8 behavior-probe grant, each separately. |
| Current authority | Owner approved r3 and granted the plan commit and implementation by one implementor session (2026-11-07): local checkpoint and correction commits, the managed test stack. No push, PR, merge, hosted read of user data or hosted write is granted. |

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
- 2026-11-07 SE-U4 correction 1 made Storage test fixtures follow the shared unclean-run rules (a marked run or a timeout refuses the next writer) and clarified the avatars WITH CHECK comment (this commit)
