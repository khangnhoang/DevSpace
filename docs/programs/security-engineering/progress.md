# Progress — security-engineering

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [SE-U3 plan](implementation-plans/se-u3-profile-access-integrity/plan.md) r2, approved by the Owner on 2026-11-06. |
| Current unit / checkpoint | SE-U3 CP0 readiness before separate-session implementation of CP1–CP3 on fix/se-u3-profile-access-integrity, baseline main 749927bbc36734d37eb755ec8458ec2a6e5ae0b0. |
| Status | Owner approved the single-PR plan and granted its local commit, implementation and local implementation/correction commits. PR #68 docs catch-up ships with this initiative; SE-P1 is resolved. No implementation checkpoint has started. |
| Completed evidence | Independent r2 plan review passed in resumed CLI session 01a1af85-6f1d-7702-bb6e-3ab91c81ca78, with 0 Critical/Required; Main verified the report and unchanged candidate hashes. The reviewer could not launch fnm; Main separately verified Node v26.13.0, docs:check and diff checks. Earlier source and hosted catalog-only discovery confirmed the missing email guard, nullable unconstrained role, pg_graphql 1.5.11 and 15 anon/15 authenticated visibility warnings. No SE-U3 behavior/migration test has run. |
| Accepted deviations | Owner decision 2026-11-06: one task-specific batch PR despite the planning skill's generic exclusion of Codex-gated/hosted items; three distinct migration/rollback pairs and all review/hosted gates remain mandatory. |
| Hosted state | SE-U3: metadata/advisors read only; no application rows read, no migration/settings change applied. External GraphQL dependents/consumers and stored role values remain unverified. SE-U2 historical acceptance: the Owner reported native current-password enforcement active, minimum length 8, no current first-password-enrollment flow and production recovery/sign-in passing before and after delivery. The preceding task recorded a successful automatic Production deployment and Auth-route HTTP 200 checks; those checks did not independently verify hosted Auth configuration. |
| Blockers / Owner decisions | Before delivery: refreshed metadata, approved role-data inspection and any repair, GraphQL dependency/rollback/partial-apply proof, separate remote delivery and hosted prepare/apply/postflight grants. Any incomplete item blocks the whole PR. |
| Next action | Main commits the approved plan/docs, refreshes the hosted metadata-only snapshot and assigns one independent implementor the approved CP1–CP3; Main reviews every checkpoint and the combined diff. |
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
- 2026-11-06 Owner approved independently reviewed SE-U3 r2 as one PR, including the PR #68 catch-up, and authorized the plan/docs commit, separate-session implementation and local checkpoint/correction commits (this commit).
