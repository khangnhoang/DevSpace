# Progress — security-engineering

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [SE-U4 plan](implementation-plans/se-u4-comment-avatar-integrity/plan.md) r3, approved by the Owner on 2026-11-07; delivered. |
| Current unit / checkpoint | None open. SE-U4 is complete (PR #70, `b03a9b4`). |
| Status | SE-U4 delivered: merged, production deploy live, hosted migrations `20261106174213` and `20261106175756` applied, catalog postflight and D8 behavior probes passed, Owner confirmed production QA; SE-P4 and SE-P5 resolved. |
| Completed evidence | PR #70 CI green on `38e212b` (typecheck, build, docs, lint, db, e2e, Vercel). Hosted postflight 2026-11-07: policy expressions, `soft_delete_comment` owner, `security definer`, `search_path` and execute grants match the migrations; 16 D8 probes passed inside one rolled-back block with no residue. Production QA on 2026-11-07 by Main in the Owner's signed-in browser (student and admin comment create and delete, student avatar under `<uid>/`) and by the Owner (admin uploads). |
| Accepted deviations | None. |
| Hosted state | Hosted migration history ends at `20261106175756_se_u4_avatar_path_ownership`. Two QA comments (ids 26 and 27) remain soft-deleted and hidden, as D3 intends; the probe inserts left only sequence gaps. |
| Blockers / Owner decisions | None. |
| Next action | The Owner selects the next security-engineering initiative or entry. Outstanding Owner-requested work not yet scheduled: SE-F2 (admins only reset another user's avatar) and SE-F3 (admin-created accounts get a password the admin never knows), in [future-features.md](future-features.md). |
| Current authority | None open; the SE-U4 grants (merge, hosted prepare and apply, D8 probes, production QA) were used and end with the task. |

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
