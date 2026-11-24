# Problems, risks and follow-ups — techstack-migration

Plan: [plan.md](plan.md). Progress: [progress.md](progress.md).

Every entry below moved here on 2026-11-08 (Owner decision 5 in the plan) with its fields kept; the old homes keep a `Moved to` line and `scripts/docs/work-id-mappings.json` maps each old ID. The label "Deferred to techstack-migration" from security-engineering means an acceptance criterion of this program. The owning unit of each entry is named in the plan's Units table.

## Open

### TM-P1: Server components use an anon client

- Status: Deferred to techstack-migration (moved from SH-P7 on 2026-11-05, Owner decisions 1 and 2); moved from SE-P13 (security-engineering) on 2026-11-08, techstack-migration Owner decision 5.
- Problem: Server components read data with the anon client, not per user.
- Evidence: Legacy P7; severity Low; discovery-era Planned: techstack-migration (out of scope for `infrastructure`, its plan section 7); preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Handle in techstack-migration, outside infrastructure (its historical plan section 7); H2-1 fixed only the learn/quiz/layout paths.
- Exit condition: Remaining server reads use the intended caller context under the migration contract.

### TM-P2: Auth flow migration follow-up

- Status: Deferred to techstack-migration (moved from SH-P8 on 2026-11-05, Owner decisions 1 and 2); moved from SE-P14 (security-engineering) on 2026-11-08, techstack-migration Owner decision 5.
- Problem: Historical finding pending revalidation: Auth uses the implicit flow; should move to PKCE.
- Evidence: Legacy P8; severity Low; discovery-era Planned: migration; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0. The historical H1 plan section 4.2 describes PKCE; this conversion does not revalidate Auth behavior or establish closure of the older record.
- Direction: Retain the original migration follow-up; no new Auth implementation or claim of completion is made here.
- Update (2026-11-09, master plan r5): TM-U9 is dropped, so no unit owns this entry. It moves to the backlog at program close unless the Owner drops it.
- Exit condition: The migration follow-up verifies the intended Auth flow and its compatibility.

### TM-P3: Email links depend on the requesting browser

- Status: Deferred to techstack-migration (moved from SH-P14 on 2026-11-05, Owner decisions 1 and 2); moved from SE-P15 (security-engineering) on 2026-11-08, techstack-migration Owner decision 5.
- Problem: Email links open only in the browser that requested them (PKCE); should move to `token_hash` + `verifyOtp` through a server route.
- Evidence: Legacy P14; severity Low; discovery-era Planned: later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Later work moves email links to token_hash plus verifyOtp through a server route; include TM-P4.
- Update (2026-11-09, master plan r5): TM-U9 is dropped, so no unit owns this entry. It moves to the backlog at program close unless the Owner drops it.
- Exit condition: Confirmation/recovery links work through the intended server route without depending on the originating browser.

### TM-P4: Confirmation without a code verifier shows an error

- Status: Deferred to techstack-migration (moved from SH-P18 on 2026-11-05, Owner decisions 1 and 2); moved from SE-P16 (security-engineering) on 2026-11-08, techstack-migration Owner decision 5.
- Problem: Opening the signup confirmation link in a browser/tab without the code verifier → the `/auth/error` page, even though the email is confirmed and sign-in works. The root cause is TM-P3 (legacy P14).
- Evidence: Legacy P18; severity Low; discovery-era Planned: with P14; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Handle with TM-P3, the recorded root cause.
- Update (2026-11-09, master plan r5): TM-U9 is dropped, so no unit owns this entry. It moves to the backlog at program close unless the Owner drops it.
- Exit condition: A valid confirmation link opened without the original verifier completes with correct feedback.

### TM-P5: Auth locks can stall multiple local tabs

- Status: Deferred to techstack-migration; monitored, the recorded workaround stays (moved from SH-P19 on 2026-11-05, Owner decisions 1 and 2); moved from SE-P17 (security-engineering) on 2026-11-08, techstack-migration Owner decision 5.
- Problem: Several `localhost` tabs open: `supabase-js` shares `navigator.locks`, auth operations wait on the lock forever → one stuck tab makes the other tabs spin on sign-in. Closing all tabs fixes it. Library behavior, not caused by H1.
- Evidence: Legacy P19; severity Low; discovery-era Planned: monitor; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Monitor the library behavior; closing all localhost tabs is the recorded workaround, not a permanent fix.
- Update (2026-11-09, master plan r5): TM-U9 is dropped, so no unit owns this entry. It moves to the backlog at program close unless the Owner drops it.
- Exit condition: The multi-tab lock problem is resolved or the Owner accepts a documented library-level limitation.

### TM-P6: Quiz results and completion are not stored

- Status: Deferred to techstack-migration (moved from SH-P20 on 2026-11-05, Owner decisions 1 and 2); moved from SE-P18 (security-engineering) on 2026-11-08, techstack-migration Owner decision 5.
- Problem: Quiz results are not stored (no table), the UI does not mark a quiz as completed like a lesson; re-entering means starting over.
- Evidence: Legacy P20; severity Medium; discovery-era Planned: future-features; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Retain as future-feature work for quiz persistence/completion; handle server grading with TM-P7.
- Exit condition: Quiz results persist and completion remains visible on re-entry.

### TM-P7: Quiz answers are sent to the client

- Status: Deferred to techstack-migration (moved from SH-P26 on 2026-11-05, Owner decisions 1 and 2; the answers reach only an enrolled learner, and the migration moves grading to the server); moved from SE-P19 (security-engineering) on 2026-11-08, techstack-migration Owner decision 5.
- Problem: The quiz is graded on the client, an enrolled user receives `correct_answer` in the payload.
- Evidence: Legacy P26; severity Low; discovery-era Planned: with P20 (grade on the server); preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Handle with TM-P6; grade on the server rather than exposing correct_answer to the enrolled client.
- Exit condition: Grading happens on the server and the client payload does not disclose correct answers before grading.

### TM-P8: a signed-in user can open /login and sign in as another account

- Status: Deferred to techstack-migration (2026-11-03; moved from BL-P9 on 2026-11-05, Owner decisions 1 and 2); moved from SE-P20 (security-engineering) on 2026-11-08, techstack-migration Owner decision 5.
- Problem: `/login` renders its forms for a visitor who already has a session, so a signed-in user can sign in again with another account without signing out first. Nothing redirects a signed-in visitor away from the page.
- Evidence: Owner QA of AF-U4 on the dev stack, 2026-11-03. `proxy.ts` has no rule for `/login`, and the page at `186530e` (before AF-U4) did not check the session either, so the behavior predates AF-U4.
- Direction: small fix: redirect a signed-in visitor from `/login` to `/` (or the safe `next` path) on the server, and add an e2e row for a signed-in actor. Decide whether "sign in as another account" should instead be offered through an explicit sign-out.
- Update (2026-11-09, master plan r5): TM-U9 is dropped, so no unit owns this entry. It moves to the backlog at program close unless the Owner drops it.
- Exit condition: a signed-in user who opens `/login` is sent away, or the page offers a deliberate sign-out first; an e2e row asserts it.

### TM-P9: an admin can change their own role and lose admin access at once

- Status: Deferred to techstack-migration (2026-11-04, Owner decision while planning AF-U6: the edit form keeps this behavior; moved from BL-P15 on 2026-11-05, Owner decisions 1 and 2); moved from SE-P21 (security-engineering) on 2026-11-08, techstack-migration Owner decision 5.
- Problem: the edit form of `/admin/users` lets an admin set their own role to `user`; the save succeeds and the admin pages refuse them from the next request. The last admin can demote themselves, leaving no admin.
- Evidence: `app/admin/users/page.tsx` sends the chosen role for any user through `editUser`; the policy "Users can update own profile or Admin" allows it (`supabase/migrations/20261021000000_baseline.sql`), read at `78c80ba`. Not reproduced.
- Direction: decide the rule first (block self-demotion in the form only, or keep at least one admin in the database); a database rule is Codex-gated.
- Exit condition: the Owner's rule is enforced where the Owner chose, or the Owner drops it.

### TM-P10: a failed user create leaves its uploaded avatar in Storage

- Status: Deferred to techstack-migration (2026-11-04, Owner decision while planning AF-U6: the upload order stays; moved from BL-P16 on 2026-11-05, Owner decisions 1 and 2); moved from SE-P22 (security-engineering) on 2026-11-08, techstack-migration Owner decision 5.
- Problem: the create form of `/admin/users` uploads the chosen avatar to the `avatars` bucket before it calls `createNewUser`; when the create fails (an email already in use, a refused field, a lost request), the uploaded object stays with no profile pointing to it.
- Evidence: `app/admin/users/page.tsx` (`uploadUserAvatar` then `createNewUser`), `lib/supabase.ts` (`uploadUserAvatar`), read at `78c80ba`. Not reproduced.
- Direction: upload after the user exists and then set the avatar, or remove the object when the create fails; either changes the write path of the form or the action, so it gets its own plan.
- Exit condition: a failed create leaves no new object in `avatars`, or the Owner drops it.

### TM-P12: course and lesson slugs have no format rule, and a course slug is not unique

- Status: Open (2026-11-04, Owner decision while planning AF-U5: the AF-U5 forms add no slug rule, and this is recorded instead); moved from BL-P12 (the backlog) on 2026-11-08, techstack-migration Owner decision 5.
- Problem: the admin course and lesson forms accept any non-blank slug (spaces, capitals, Vietnamese accents, `/`), which then becomes the `/course/<slug>` or `/learn/<course>/<lesson>` URL. `lessons.slug` is unique (`lessons_slug_key`), but `courses.slug` has no unique constraint, and the course readers use `.eq("slug", …).single()` (`lib/supabase.ts:60-63`), so a second course with the same slug makes its page fail.
- Evidence: `supabase/migrations/20261021000000_baseline.sql` (only `lessons_slug_key`, read at `cc2d5ff`); `app/admin/courses/coursesclient.tsx` and `app/admin/lessons/page.tsx` send the typed slug unchanged. Hosted slugs were not read (reading data rows needs the Owner's approval).
- Direction: first read the hosted slugs (Owner-approved read) to see whether any existing slug breaks a kebab-case rule or is duplicated; then a migration with a unique constraint on `courses.slug` (Codex-gated, `supabase-migration`) and a slug rule in the admin schemas that new and edited slugs follow, with a plan for any existing slug that does not. Possibly with the techstack migration's schema review (TM-F4).
- Update (2026-11-07, Owner decision): this will be done with TM-F4 in the techstack migration.
- Exit condition: two courses cannot share a slug, and a slug the forms accept is a valid URL segment, or the Owner drops it.

### TM-P13: the Header search puts the typed text into a PostgREST filter unescaped

- Status: Open and deferred (Owner decision 15, 2026-11-10). The legacy Header search is outside the migration. Found on 2026-11-07 and moved from BL-P20 under decision 5.
- Problem: `searchLesson` (`lib/supabase.ts:228`) builds ``.or(`name.ilike.%${query}%`)`` from the search box, so a query containing `,`, `)` or a filter keyword can change or break the filter; it also runs the query before checking for blank input.
- Evidence: read at `259f123`; not reproduced. The browser client runs as anon or the user under RLS, so the reach is limited to rows RLS already allows.
- Direction: use ``.ilike("name", `%${escaped}%`)`` with `%`, `_` and `\` escaped, and return early on blank input; add a unit or e2e row with a query containing `,`.
- Exit condition: the legacy search is removed, or a query with filter characters searches for literal text and cannot add a filter.

### TM-P15: a 504 from the API does not cancel its handler, and a stalled request body is not bound by the 60-second limit

- Status: Open (2026-11-09, found by the TM-U3 Codex gate on the implementation; recorded by the implementor).
- Problem: the request limit is an rxjs `timeout` on the handler's stream (`backend/src/common/timeout.interceptor.ts`). When it fires the client gets a 504, but the handler keeps running: its database writes and outbound calls are not cancelled and may still commit. A later unit must not read a 504 as "the write did not happen". The body of a request is read by the body interceptor before that stream starts, so a client that opens a request and stops sending its body is bounded by Node's default `http.Server` `requestTimeout` (300 seconds), not by the 60-second limit.
- Evidence: `timeout.interceptor.ts` and `backend/src/common/limits.ts` (read at `42a865f`); the `proof-gate` rows for the 35, 58 and 65 second waits assert the 504 and the status codes, not a cancelled handler. The 300-second default is Node's documented value; no row measures it.
- Direction: when a unit adds a write or an outbound call behind a route, give it its own idempotency or an abort signal tied to the request, and treat a 504 as unknown outcome. Decide at the TM-U3 rollout proofs whether to set `requestTimeout` on the server explicitly.
- Update (2026-11-09): the rollout did not decide it: T3 proved the 504 at 60 seconds on production and nothing about a cancelled handler or a stalled body. It stays open for the first unit that adds a write or an outbound call behind a route. PR 2 removed the proof rows of the 35, 58 and 65 second waits; the 504 itself keeps its row in `__tests__/api/validation.test.ts`.
- Exit condition: a 504 is documented in the API contract as an unknown outcome and the longest wait a request body can cause is set and proven, or the Owner accepts both as they are.

### TM-P16: `sslmode=require` is mapped to encryption without server verification

- Status: Open (2026-11-09, found by the TM-U3 Codex gate on the implementation; recorded by the implementor).
- Problem: `poolConfig` (`backend/src/db/pool.ts`) turns `sslmode=require` into `ssl: { rejectUnauthorized: false }`, because node-postgres reads `require` as `verify-full` and the pooler's certificate chain is not in Node's store. The connection to the hosted database is encrypted, but the server's certificate is not checked, so a machine in the path could answer as the database.
- Evidence: `backend/src/db/pool.ts` and the `poolConfig` row of `__tests__/unit/api-config.test.ts` (read at `42a865f`); the Owner's hosted connection string carries `sslmode=require` as the Supabase dashboard writes it.
- Direction: at the rollout, consider `sslmode=verify-full` with the Supabase CA certificate supplied to the pool, and a row that a wrong certificate is refused. Not changed now: the hosted URL and the CA file are the Owner's settings.
- Update (2026-11-09): the rollout did not decide it: R2 passed through the session pooler with `sslmode=require`, and neither a CA file nor `verify-full` was tried. It stays open for the Owner.
- Exit condition: the hosted connection verifies the server certificate, or the Owner accepts the risk as it is.

### TM-P18: no frontend procedure for a page that reads through the API

- Status: Open (2026-11-14, found by the instruction audit of AW-U14; recorded by the implementor).
- Problem: `frontend-design` and `frontend-workflow` describe pages that read with the Supabase clients and server actions. No skill tells an agent how a page or component reads data through the API (`lib/api.server.ts`, the `/api/*` rewrite in `proxy.ts`): where the call sits, how a refused or failed call reaches the UI state, and what the page test fakes. Each frontend unit that moves a read would invent it.
- Evidence: a search of `.claude/skills/` for `api.server` and `API_INTERNAL_URL` finds only `server-actions/SKILL.md`, which covers the controller side (read at `2ddfce8`). Tooling-specific skill content that a unit adds together with its tooling stays with this program (agent-workflow charter, Boundary).
- Direction: the first frontend unit that moves a page's read behind the API adds the procedure to `frontend-workflow` in the same change, from the page it moves.
- Exit condition: `frontend-workflow` holds the procedure for a page that reads through the API, and a unit's plan cites it.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- TM-P17 — Resolved 2026-11-09: no upload moves behind the Vercel rewrite, because uploads stay straight to Supabase Storage (master plan decision 10); the T1 figures stay in ADR 0008 D5 and binary bodies of 4 MiB through Vercel stay unsupported (master plan r5).
- TM-P14 — Resolved 2026-11-09: no `x-middleware-rewrite` header on a deployed anonymous `/api/health` response, and the Owner accepts that reading (Owner decision 30, `e651698`).
- TM-P11 — Resolved 2026-11-24: the Wandbox C++ runner shows successful output and compiler errors, both verified on production by Main at the Owner's request (PR #91).
