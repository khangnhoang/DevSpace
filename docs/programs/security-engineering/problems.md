# Problems, risks and follow-ups — security-engineering

Charter: [README.md](README.md). Progress: [progress.md](progress.md).

Every entry below moved here on 2026-11-05 (Owner decisions 1 and 2) from the closed `security-hotfix` program or from the backlog, with its fields kept; the old homes keep a `Moved to` line and `scripts/docs/work-id-mappings.json` maps each old ID. Evidence lines that cite "Legacy P<n>" and baseline ddcefd0 are provenance of the 2026-10-21 discovery. The label "Open, before migration" means a production exposure to fix before the techstack migration: data readable or writable by the wrong actor on production today, or a write that corrupts payment, coupon or permission state on production today (the H2-2b entries SE-P8 to SE-P12 and the role constraint SE-P7); "Deferred to techstack-migration" means an acceptance criterion of that migration.

## Open

### SE-P13: Server components use an anon client

- Status: Deferred to techstack-migration (moved from SH-P7 on 2026-11-05, Owner decisions 1 and 2).
- Problem: Server components read data with the anon client, not per user.
- Evidence: Legacy P7; severity Low; discovery-era Planned: techstack-migration (out of scope for `infrastructure`, its plan section 7); preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Handle in techstack-migration, outside infrastructure (its historical plan section 7); H2-1 fixed only the learn/quiz/layout paths.
- Exit condition: Remaining server reads use the intended caller context under the migration contract.

### SE-P14: Auth flow migration follow-up

- Status: Deferred to techstack-migration (moved from SH-P8 on 2026-11-05, Owner decisions 1 and 2).
- Problem: Historical finding pending revalidation: Auth uses the implicit flow; should move to PKCE.
- Evidence: Legacy P8; severity Low; discovery-era Planned: migration; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0. The historical H1 plan section 4.2 describes PKCE; this conversion does not revalidate Auth behavior or establish closure of the older record.
- Direction: Retain the original migration follow-up; no new Auth implementation or claim of completion is made here.
- Exit condition: The migration follow-up verifies the intended Auth flow and its compatibility.

### SE-P15: Email links depend on the requesting browser

- Status: Deferred to techstack-migration (moved from SH-P14 on 2026-11-05, Owner decisions 1 and 2).
- Problem: Email links open only in the browser that requested them (PKCE); should move to `token_hash` + `verifyOtp` through a server route.
- Evidence: Legacy P14; severity Low; discovery-era Planned: later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Later work moves email links to token_hash plus verifyOtp through a server route; include SE-P16.
- Exit condition: Confirmation/recovery links work through the intended server route without depending on the originating browser.

### SE-P16: Confirmation without a code verifier shows an error

- Status: Deferred to techstack-migration (moved from SH-P18 on 2026-11-05, Owner decisions 1 and 2).
- Problem: Opening the signup confirmation link in a browser/tab without the code verifier → the `/auth/error` page, even though the email is confirmed and sign-in works. The root cause is SE-P15 (legacy P14).
- Evidence: Legacy P18; severity Low; discovery-era Planned: with P14; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Handle with SE-P15, the recorded root cause.
- Exit condition: A valid confirmation link opened without the original verifier completes with correct feedback.

### SE-P17: Auth locks can stall multiple local tabs

- Status: Deferred to techstack-migration; monitored, the recorded workaround stays (moved from SH-P19 on 2026-11-05, Owner decisions 1 and 2).
- Problem: Several `localhost` tabs open: `supabase-js` shares `navigator.locks`, auth operations wait on the lock forever → one stuck tab makes the other tabs spin on sign-in. Closing all tabs fixes it. Library behavior, not caused by H1.
- Evidence: Legacy P19; severity Low; discovery-era Planned: monitor; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Monitor the library behavior; closing all localhost tabs is the recorded workaround, not a permanent fix.
- Exit condition: The multi-tab lock problem is resolved or the Owner accepts a documented library-level limitation.

### SE-P18: Quiz results and completion are not stored

- Status: Deferred to techstack-migration (moved from SH-P20 on 2026-11-05, Owner decisions 1 and 2).
- Problem: Quiz results are not stored (no table), the UI does not mark a quiz as completed like a lesson; re-entering means starting over.
- Evidence: Legacy P20; severity Medium; discovery-era Planned: future-features; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Retain as future-feature work for quiz persistence/completion; handle server grading with SE-P19.
- Exit condition: Quiz results persist and completion remains visible on re-entry.

### SE-P19: Quiz answers are sent to the client

- Status: Deferred to techstack-migration (moved from SH-P26 on 2026-11-05, Owner decisions 1 and 2; the answers reach only an enrolled learner, and the migration moves grading to the server).
- Problem: The quiz is graded on the client, an enrolled user receives `correct_answer` in the payload.
- Evidence: Legacy P26; severity Low; discovery-era Planned: with P20 (grade on the server); preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Handle with SE-P18; grade on the server rather than exposing correct_answer to the enrolled client.
- Exit condition: Grading happens on the server and the client payload does not disclose correct answers before grading.

### SE-P20: a signed-in user can open /login and sign in as another account

- Status: Deferred to techstack-migration (2026-11-03; moved from BL-P9 on 2026-11-05, Owner decisions 1 and 2).
- Problem: `/login` renders its forms for a visitor who already has a session, so a signed-in user can sign in again with another account without signing out first. Nothing redirects a signed-in visitor away from the page.
- Evidence: Owner QA of AF-U4 on the dev stack, 2026-11-03. `proxy.ts` has no rule for `/login`, and the page at `186530e` (before AF-U4) did not check the session either, so the behavior predates AF-U4.
- Direction: small fix: redirect a signed-in visitor from `/login` to `/` (or the safe `next` path) on the server, and add an e2e row for a signed-in actor. Decide whether "sign in as another account" should instead be offered through an explicit sign-out.
- Exit condition: a signed-in user who opens `/login` is sent away, or the page offers a deliberate sign-out first; an e2e row asserts it.

### SE-P21: an admin can change their own role and lose admin access at once

- Status: Deferred to techstack-migration (2026-11-04, Owner decision while planning AF-U6: the edit form keeps this behavior; moved from BL-P15 on 2026-11-05, Owner decisions 1 and 2).
- Problem: the edit form of `/admin/users` lets an admin set their own role to `user`; the save succeeds and the admin pages refuse them from the next request. The last admin can demote themselves, leaving no admin.
- Evidence: `app/admin/users/page.tsx` sends the chosen role for any user through `editUser`; the policy "Users can update own profile or Admin" allows it (`supabase/migrations/20261021000000_baseline.sql`), read at `78c80ba`. Not reproduced.
- Direction: decide the rule first (block self-demotion in the form only, or keep at least one admin in the database); a database rule is Codex-gated.
- Exit condition: the Owner's rule is enforced where the Owner chose, or the Owner drops it.

### SE-P22: a failed user create leaves its uploaded avatar in Storage

- Status: Deferred to techstack-migration (2026-11-04, Owner decision while planning AF-U6: the upload order stays; moved from BL-P16 on 2026-11-05, Owner decisions 1 and 2).
- Problem: the create form of `/admin/users` uploads the chosen avatar to the `avatars` bucket before it calls `createNewUser`; when the create fails (an email already in use, a refused field, a lost request), the uploaded object stays with no profile pointing to it.
- Evidence: `app/admin/users/page.tsx` (`uploadUserAvatar` then `createNewUser`), `lib/supabase.ts` (`uploadUserAvatar`), read at `78c80ba`. Not reproduced.
- Direction: upload after the user exists and then set the avatar, or remove the object when the create fails; either changes the write path of the form or the action, so it gets its own plan.
- Exit condition: a failed create leaves no new object in `avatars`, or the Owner drops it.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- SE-P2 — Resolved 2026-11-05: the activation mail escapes the learner name, the course name and the link, so markup in a name shows as plain text (PR 66, `b6f1902`); `full_name` stays without a length limit where it is saved.
- SE-P1 — Resolved 2026-11-06: PR #68 (749927bb) binds password reset to a verified recovery session; native current-password enforcement passed the local API proof, and the Owner reported the hosted control active and production recovery/sign-in passing before and after deployment.
- SE-P3 — Resolved 2026-11-07: PR #69 (`e76cc05`) blocks client email and identity changes and client profile INSERT/UPSERT; hosted migration `20261106094309` applied, and the Owner confirmed hosted acceptance and production QA.
- SE-P7 — Resolved 2026-11-07: PR #69 (`e76cc05`) enforces a validated user/admin CHECK and NOT NULL on `profiles.role`; hosted migration `20261106095706` applied, and the Owner confirmed hosted acceptance and production QA.
- SE-P6 — Resolved 2026-11-07: PR #69 (`e76cc05`) removes the unused `pg_graphql` extension after dependency checks, with an exact 1.5.11 rollback; hosted migration `20261106100209` applied, and the Owner confirmed the postflight, Advisor 0026/0027 and production QA.
- SE-P4 — Resolved 2026-11-07: PR #70 (`b03a9b4`) hides soft-deleted comments from every API role while keeping their content, requires enrollment or admin for new comments and soft-deletes through `soft_delete_comment`; hosted migration `20261106174213` applied, the catalog postflight and the D8 behavior probes passed, and the Owner confirmed production QA.
- SE-P5 — Resolved 2026-11-07: PR #70 (`b03a9b4`) limits non-admin `avatars` writes to the user's own `<uid>/` folder while admins keep any path; hosted migration `20261106175756` applied, the catalog postflight and the D8 behavior probes passed, and the Owner confirmed production QA.
- SE-P8 — Resolved 2026-11-07: PR 71 (`268545d`) and PR 72 (`8fb9b59`) add the database payment functions behind the payment actions, so coupon usage changes through apply, switch and cancel; hosted M1 and M2 applied with postflights and D5 probes, and production QA passed.
- SE-P9 — Resolved 2026-11-07: PR 71 (`268545d`) and PR 72 (`8fb9b59`) reserve a coupon use when a code is applied and release it on cancel, reject, switch or delete, in one reservation invariant; production QA passed.
- SE-P10 — Resolved 2026-11-07: PR 71 (`268545d`) makes approval and rejection act only on a pending order, with the enrollment committed in the same transaction; production QA passed.
- SE-P11 — Resolved 2026-11-07: PR 71 (`268545d`) refuses a pending order for a course the user already owns and allows one pending order per user and course; production QA passed.
- SE-P12 — Resolved 2026-11-07: PR 71 (`268545d`) applies a coupon without a use limit the same way in order creation and coupon application; PR 72 (`8fb9b59`) revokes the direct `payments` INSERT and UPDATE grants.
