# Progress — security-engineering

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [SE-U5 plan](implementation-plans/se-u5-public-repo-readiness/plan.md) r3, approved by the Owner on 2026-11-16 after the Codex plan gate passed in round 4. |
| Current unit / checkpoint | None. SE-U5 is complete. |
| Status | SE-U5 delivered: the payment modal reads the bank account and account-holder name from three public variables (PR 90), and the Owner switched `khangnhoang/DevSpace` to public on 2026-11-17 with its history as it is. No initiative is open. |
| Completed evidence | SE-U5: Codex gates on the plan and on the implementation passed, CI was green on `d5cf09f`, the Owner's QR check passed on the preview and on production, and AC6 was checked signed out; the figures are in Milestones and the PR 90 body. Historical: SE-U1 to SE-U4 milestones below. |
| Accepted deviations | The placeholders live in one helper, `__tests__/helpers/payment-placeholders.ts`, which both environment maps spread (section 3 named the maps only). The PF1 check is not added to the dated layer-audit header of `payment-learner.spec.ts`, which records a past audit. |
| Hosted state | Hosted migration history ends at `20261106214043_se_u1_payment_write_lock` (M2), applied on 2026-11-07 under the Owner's prepare and apply grants, after `20261106211345_se_u1_payment_rpcs` (M1). M1 catalog postflight: the four functions are `security definer` with an empty `search_path`, owned by `postgres` and executable only by `service_role`; the three guard triggers, the statement-level release trigger, the partial unique index and the `coupon_id` FK (`on delete restrict`) are present. M2 postflight: the `payments` grants for anon, authenticated and service_role are DELETE, REFERENCES, SELECT, TRIGGER and TRUNCATE, with no INSERT or UPDATE. M2 D5 probe (Owner grant: `student@devspace.com`, course `ngonngu-c` id 22, coupon `SV2025`) as service_role in a rolled-back transaction: a direct insert and a direct update each returned 42501; create, apply (+1 use), cancel (−1 use) and approve (success, plus enrollment) all worked; anon and authenticated inserts returned 42501; afterwards no order or enrollment remained and `SV2025` was at 0 uses. Production keeps the QA orders PAY101 (failed) and PAY102 (success, enrolled). The branches `fix/se-u1-payment-write-integrity` and `fix/se-u1-payment-write-lock` remain on origin. The Vercel preview deployments read the production database (Owner, 2026-11-16), so the SE-U5 preview QA left the cancelled order PAY103 (failed) there; Git Fork Protection is on in Vercel, and Actions requires approval for every external contributor (Owner, 2026-11-17). |
| Production QA | Passed on 2026-11-07 (plan runbook step 11) as `student@devspace.com` on `ngonngu-c`, after the Owner signed in: an invalid code left the amount at 500000; `SV2025` gave 400000 and its use count went 0 to 1; cancelling PAY101 set it to failed and the count back to 0; PAY102 with `SV2025` went to pending and showed "Đang chờ duyệt"; the Owner approved PAY102 as admin, so it became success, the student was enrolled and `SV2025` stayed at 1. Not checked: the approval mail, and the coupon switch in the UI (the code field locks once a code is applied; the switch was proven only by the D5 probe). |
| Blockers / Owner decisions | None. |
| Next action | None. The Owner selects the next initiative. |
| Current authority | None active. |

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
- 2026-11-07 SE-U1 CP1 added M1 (`coupon_id`, one pending order per user and course, four payment functions, transition guard and delete release triggers) with its rollback; payments 37/37 and the full local suite 877/877 passed with a clean audit (`e7df5c0`)
- 2026-11-07 SE-U1 CP2 moved the payment actions onto the database functions with Zod schemas, made the payment modal show a refused cancel, and turned K4 to K8 into normal rows; `npm test` 931/931 and E2E 160/160 passed with clean audits (`f68cd28`)
- 2026-11-07 SE-U1 CP3 added M2 (direct INSERT and UPDATE on `payments` revoked from the API roles) with its rollback and tests; `npm test` 940/940 and E2E 160/160 passed with clean audits on the stacked branch (`e3badc7`)
- 2026-11-07 SE-U1 correction 1 after the Codex implementation gate: coupon amount computed in numeric, create retries when its conflicting order closes, the guard exempts only `postgres`, lock-order and negative-write rows made deterministic and owned (`4ed7814`)
- 2026-11-07 SE-U1 merged correction 1 into the write lock branch (`1c0ceb4`) and made the write-lock rows own the fixtures they write; `npm test` 947/947 and E2E 160/160 passed with clean audits (`bd2ef9a`)
- 2026-11-07 SE-U1 correction 2 made the W6a test hook commit in one transaction and every cleanup step independent, with a check that no hook object remains; `npm test` 938/938 passed with a clean audit (`73896f8`)
- 2026-11-07 SE-U1 merged correction 2 into the write lock branch (`ce92690`) and made the write-lock rows assert their owned pending order; `npm test` 947/947 passed with a clean audit (`82f0355`)
- 2026-11-07 SE-U1 correction 3 marks the test run unclean when the W6a hook cleanup fails, proven by a forced DROP failure that left the run state dirty; `npm test` 938/938 passed on the following clean reset (`a50f852`)
- 2026-11-07 SE-U1 merged correction 3 into the write lock branch; `npm test` 947/947 passed with a clean audit (`0f4b1ed`)
- 2026-11-07 SE-U1 Codex implementation gate PASS in round 4; M1 applied to hosted with catalog postflight and D5 behavior probes passed; PR 1 merged and deployed to production (PR 71, 268545d)
- 2026-11-07 SE-U1 M2 applied to hosted with its postflight and D5 probe, and PR 2 delivered with the direct `payments` INSERT and UPDATE revoked from the API roles (PR 72, `8fb9b59`)
- 2026-11-07 SE-U1 production QA passed on both deploys: coupon applied, cancelled and re-applied, and an admin approval enrolled the student; SE-P8 to SE-P12 resolved (PR 72, `8fb9b59`)
- 2026-11-16 Owner approved SE-U5 r3 (public repository readiness) after Codex PASS in round 4, set the three payment variables on Vercel, and granted the plan commit and implementation (`e332e46`)
- 2026-11-16 SE-U5 CP1 moved the payment QR's bank code, account number and account-holder name into three public variables with invented placeholders for dev, e2e and CI, and blocks payment when one is missing or blank; unit, component and e2e rows proven by mutations (`aee11da`)
- 2026-11-16 SE-U5 CP2 named the three payment variables in the README's environment section, without values (`1f4d779`)
- 2026-11-16 SE-U5 Final row passed locally: build, `npm test` 1370/1370 and `npm run test:e2e` 183/183 (`8a452ca`)
- 2026-11-16 SE-U5 Main's review and the Codex implementation gate passed on `e332e46..8a452ca` with one Nit, corrected in `b0389b9` (`d5cf09f`)
- 2026-11-16 SE-U5 delivered: CI green on `d5cf09f`, the Owner scanned the QR on the pull request's preview and cancelled the order, and the pull request merged (PR 90, `f10c1d5`)
- 2026-11-17 SE-U5 rollout: the Owner's QR check passed on production, the Owner made `khangnhoang/devspace-app` private and reports that the two old README passwords no longer sign in; Main's repeat scan of the 857 commits on the three remaining remote refs and of 90 pull requests matched no key, token or private key, and `main` held neither removed value (PR 90, `f10c1d5`)
- 2026-11-17 SE-U5 completed: the Owner switched `khangnhoang/DevSpace` to public; the repository, its pull requests and its Actions runs answered HTTP 200 signed out (AC6) (PR 90, `f10c1d5`)
