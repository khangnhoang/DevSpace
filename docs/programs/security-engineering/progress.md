# Progress — security-engineering

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [SE-U3 plan](implementation-plans/se-u3-profile-access-integrity/plan.md) r2, approved by the Owner on 2026-11-06. |
| Current unit / checkpoint | SE-U3 CP1 implemented locally on fix/se-u3-profile-access-integrity from afda0d2 (product baseline 749927bbc36734d37eb755ec8458ec2a6e5ae0b0); awaiting Main's checkpoint review before CP2. |
| Status | CP1 focused automated checks passed; M1 protects client email/identity and restricts client INSERT, with individual rollback/reapply proven. CP2/CP3 and the combined independent gate/final regression remain pending. PR #68 docs catch-up is retained; SE-P1 remains resolved. |
| Completed evidence | Session 01a1b03b-80ad-7153-b021-5a9a40bbb879 verified gpt-6.1-sol / medium and Node v26.13.0. M1 20261106094309 replayed through the managed test runner. Profiles: 27/27 after migration reset and 27/27 on retained state, including exact catalog/ACL rollback/reapply and genuine signup; clean end-of-run audits. Unit/components: 661/661. Focused E2E F1/U1/U6 plus sign-in setup: 6/6, retained stack and clean audit; profile email read-back, admin role/name/avatar edit and real server admin creation passed. Typecheck, lint (0 problems), docs:check and diff/format checks passed. Logs: ignored .supabase-test/se-u3-evidence/. Historical r2 plan review and Main's verification remain at afda0d2. |
| Accepted deviations | Owner decision 2026-11-06: one task-specific batch PR despite the planning skill's generic exclusion of Codex-gated/hosted items; three distinct migration/rollback pairs and all review/hosted gates remain mandatory. |
| Hosted state | SE-U3: Main's 2026-11-06 refreshed metadata-only snapshot matches the reviewed profile definitions/ACLs/history and records pg_graphql 1.5.11, no external catalog dependents of the extension or its members, and no known public-function/app/lib caller. External consumers remain unproven; stored role values and live GraphQL reachability were not read/tested. Advisor 15 anon/15 authenticated warnings remain historical. No implementor hosted access or migration/settings change occurred. SE-U2 historical acceptance: the Owner reported native current-password enforcement active, minimum length 8, no current first-password-enrollment flow and production recovery/sign-in passing before and after delivery. The preceding task recorded a successful automatic Production deployment and Auth-route HTTP 200 checks; those checks did not independently verify hosted Auth configuration. |
| Blockers / Owner decisions | Before delivery: refreshed metadata, approved role-data inspection and any repair, GraphQL dependency/rollback/partial-apply proof, separate remote delivery and hosted prepare/apply/postflight grants. Any incomplete item blocks the whole PR. |
| Next action | Main reviews the actual CP1 commit/diff and report; after acceptance, resume the same implementor session for assigned CP2, then CP3. |
| Current authority | Owner grants on 2026-11-06 cover plan approval, its local commit, implementation of r2 and local checkpoint/correction commits. Local database work is limited to the managed devspace-test stack through the approved plan and runner lock. No push, PR, merge, branch deletion, direct deployment, hosted user-data read or hosted write is granted. |

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
- 2026-11-06 SE-U3 CP1 added M1 email/identity protection and client INSERT restriction; focused profiles, individual rollback/reapply, signup and browser profile/admin compatibility passed locally with clean managed audits; hosted acceptance remains pending (this commit).
