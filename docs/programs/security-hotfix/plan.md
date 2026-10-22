# Security hotfix — H1: block privilege escalation and guard server actions

Progress: [progress.md](progress.md).
Branch: `fix/auth-server-guard`
Risk level: High (auth, admin permissions, payment, hosted DB) → Codex reviews both the plan and the diff.
Next part: H2 (see [problems.md](problems.md)) — not done in H1.

## 1. Background (verified 2026-10-21)

Sources: code on `main` @ `3d565dd` and the metadata of the hosted DB `lkvxxrxojjlkchzzqidu` (pg_policies, pg_proc, pg_trigger, column grants, security advisors). No data rows were read.

1. **The session lives only in localStorage.** `lib/supabase.ts` uses `createClient` from `@supabase/supabase-js`; there is no `middleware.ts`/`proxy.ts`. The server (server components, server actions) never knows who the caller is.
2. **Server actions use the service role and do not check the caller.** Every export in `app/action/*.ts` is a public POST endpoint. Examples: `approvePayment`, `rejectPayment`, `getAllPayments`, `createNewUser`, `deleteUserAccount`, the `admin-dashboard.ts` functions, `generateQuizFromContent` (costs API money).
3. **`enrollCourse(courseId, userId, price)`** trusts `userId` and `price` from the client → enroll in a paid course for free by sending the right price, or enroll someone else.
4. **`sendSuccessEmail`** is exported from a `"use server"` file → anyone can send email to any address through the system's Gmail.
5. **Privilege escalation in the DB:**
   - `handle_new_user()` (trigger `on_auth_user_created`) writes `role = COALESCE(raw_user_meta_data->>'role', 'user')`. Anyone who calls `auth.signUp({ options: { data: { role: 'admin' } } })` with the anon key becomes an admin.
   - The policy `"Users can update own profile or Admin"` on `profiles` (UPDATE, `qual = auth.uid() = id OR is_admin()`, `with_check = null`) plus the column grant UPDATE on `profiles.role` for `authenticated` → a user can change their own `role` to `admin`.
   - `handle_new_user` and `is_admin` are `SECURITY DEFINER`, do not set `search_path`, and `anon`/`authenticated` can call them through `/rest/v1/rpc/*`.
6. **Admin is blocked only on the client** (`app/admin/layout.tsx` checks the role in a `useEffect`).
7. Dead code: `confirmPaymentAndEnroll` (payment.ts) and `app/components/CoursePayment.tsx` are no longer imported, but `confirmPaymentAndEnroll` is still an action that sets `payments.status = 'success'` without any payment.
8. **Fixed password**: `app/admin/users/page.tsx:128` always sends `password: "123123"` when creating a user; `app/action/user.ts` also defaults to `'123123'`. Combined with email and role being publicly readable in `profiles` → anyone can sign in as any admin created through the UI.
9. **Open redirect / XSS in the callback**: `app/auth/callback/page.tsx` passes `searchParams.get("next")` straight to `router.replace` (including the timeout branch that needs no sign-in) → `?next=javascript:...` or a URL outside the origin.
10. **Non-atomic payment updates**: `updatePaymentWithCoupon` and `cancelPayment` filter only by `id` in the UPDATE.

The RLS of the content tables (courses, chapters, lessons, exercises) already blocks writes for non-admins, so the admin writes from the browser in `lib/supabase.ts` are safe **if and only if** nobody can make themselves admin — which is why item 5 is the focus.

## 2. Goals and acceptance criteria

All of these must be true after H1:

- A1. Signing up with `role: 'admin'` in the metadata → the new profile has `role = 'user'`.
- A2. A regular (non-admin) user updating their own `profiles.role` (or inserting a profile with role admin) → rejected by the DB.
- A3. An admin changing another user's role from the `/admin/users` page still works. `createNewUser` called by an admin with `role: 'admin'` still creates an admin.
- A4. Every admin-only server action returns an error (and runs no service-role query) when the caller is not signed in or is not an admin.
- A5. Learner-side server actions take the user from the session, not from a parameter; they act only on that user's own payments.
- A6. `enrollCourse` enrolls only courses with `price = 0`; a paid course is enrolled only through `approvePayment` (admin).
- A7. `sendSuccessEmail` is no longer a server action callable from the client.
- A8. Visiting `/admin/*` while signed out → redirect to `/login`; signed in but not admin → redirect to `/`. The check runs on the server, before rendering.
- A9. Sign in, sign out, sign up, forgot password → reset password, browse courses, learn lessons, quiz, notes, comments, payment → admin approval, admin CRUD: behave as before. Known exceptions: (a) a signed-in user must sign in once more because the session moves from localStorage to a cookie; (b) auth moves to PKCE (4.2), so email links sent before the deploy stop working, and new links must be opened in the same browser that requested them.
- A10. `npm run lint` adds no new errors against the baseline; `npx tsc --noEmit` and `npm run build` pass.
- A11. No fixed password remains: creating a user from admin requires the admin to enter a password of at least 8 characters; the action rejects a missing or shorter one.
- A12. The callback redirects only to an allowlisted destination (`/`, `/auth/reset-password`); any other `next` value (absolute URL, `//host`, `javascript:`, unknown path) → `/`.
- A13. `updatePaymentWithCoupon` and `cancelPayment` change only rows that satisfy `id`, `user_id = current user` and `status = 'pending'` at the same time, inside the UPDATE statement itself; 0 rows changed → return an error.

Must stay unchanged: table schema, data, the other RLS policies, the UI (except the new password field in the create-user form).

## 3. Out of scope (recorded in problems.md, done in H2 or later)

Paid lesson/quiz content readable without enrolling (P13 — the Owner decided to put it in H2, split into H2-1/H2-2 if large); PII in `profiles` readable publicly; `coupons` readable publicly and the coupon check on the client; the `reviews` policy not constraining `user_id`; `comments` UPDATE without `with_check`; the RPC `increment_coupon_usage` not existing in the DB; a coupon being counted when the pending order is created; turning on leaked password protection; GraphQL exposure; the `avatars` bucket allowing uploads to any path; moving email links to `token_hash` + `verifyOtp` so they open in another browser.

## 4. Design

### 4.1 DB — migration `supabase/migrations/20261021131351_h1_block_role_escalation.sql`

The repo has no `supabase/` folder yet. Create this migration file as a historical record (there is no schema baseline yet; the baseline belongs to the test-infra program). Sonnet only writes the file and **does not apply it**. Main applies it to the hosted DB after the Owner approves (Supabase MCP `apply_migration`), then verifies.

Required content:

1. `create or replace function public.handle_new_user()` — keep the columns it writes now, but `role` is always `'user'` (drop reading `raw_user_meta_data->>'role'`). Add `set search_path = ''` and change references to `public.profiles`.
2. `create or replace function public.is_admin()` — keep the logic, add `set search_path = ''`, reference `public.profiles`.
3. `alter function public.update_updated_at_column() set search_path = ''`.
4. New trigger function `public.prevent_role_escalation()` — **`security invoker`** (the default, no `security definer` declared), `set search_path = ''`:
   - `BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW` (not `UPDATE OF role`, so it does not depend on the column list of the statement).
   - Because it is invoker, `current_user` is the role actually running the statement: `anon`/`authenticated` for PostgREST requests, `service_role` for the service key, `postgres` for the dashboard and for the body of `handle_new_user` (a `security definer` function owned by `postgres`).
   - Let it through when `current_user not in ('anon', 'authenticated')` or `public.is_admin()` is true (`is_admin` is `security definer`, so `authenticated` can call it).
   - Otherwise: INSERT with `NEW.role is distinct from 'user'` → `raise exception`; UPDATE with `NEW.role is distinct from OLD.role` → `raise exception`.
   - An SQL comment explains why `security invoker` was chosen.
5. `revoke execute on function public.handle_new_user() from public, anon, authenticated;` (only the trigger uses it).
6. Do not revoke `is_admin()`, because RLS policies call it with the role `authenticated`.
7. Everything in one transaction; idempotent when re-run (`create or replace`, `drop trigger if exists`).

Include the rollback file `supabase/rollbacks/20261021131351_h1_block_role_escalation.down.sql` that restores the exact old definitions of `handle_new_user`/`is_admin` (from item 1 above — Main already has the `pg_get_functiondef` output, see Appendix A) and drops the new trigger/function.

### 4.2 Session via cookie

- `lib/supabase.ts`: replace `createClient(...)` with `createBrowserClient(url, key)` from `@supabase/ssr`, still exporting the name `supabase` so the ~30 imports need no change.
- **Auth moves to PKCE.** `createBrowserClient` in `@supabase/ssr@0.7.0` forces `flowType: "pkce"` (`node_modules/@supabase/ssr/src/createBrowserClient.ts`, the `auth` block) and cannot keep implicit. Consequences and handling:
  - Email links (signup confirmation, forgot password) now return to `/auth/callback?code=...&next=...`.
  - **Exchange the code on the server, not on the client.** Replace `app/auth/callback/page.tsx` (client) with the route handler `app/auth/callback/route.ts` (GET) following the standard Supabase SSR pattern: read `code`, call `exchangeCodeForSession(code)` with `createSupabaseServerClient()` (the code verifier is in a cookie written by `@supabase/ssr`). Reason: success counts only when **this very request** exchanges the code successfully, not merely when "a session exists". If the check were done on the client with `getSession()`, a browser signed in as user A that opens B's recovery link without the verifier would get A's session back, and the reset page would then change A's password (Codex round 3). The browser never loads a page with `?code=`, so the browser client's `detectSessionInUrl` does not run in parallel.
  - On success → `NextResponse.redirect` to `safeNextPath(next)` on the same origin; the new session cookie (the link owner's) overwrites the old session.
  - Missing `code`, an `error`/`error_description`, or `exchangeCodeForSession` returning an error (old implicit-style link, opened in another browser, expired code, missing verifier) → redirect to the new page `app/auth/error/page.tsx`, which shows a clear error message and a button back to `/login`. The existing session is not touched.
  - `app/auth/reset-password/page.tsx` stays as it is.
  - Check that `emailRedirectTo`/`redirectTo` in `app/(main)/login/page.tsx` still point to `/auth/callback`.
- **`next` allowlist in the callback** (A12): a pure function `safeNextPath(raw: string | null): "/" | "/auth/reset-password"` in `lib/safe-next-path.ts`, used by both the success branch and the timeout branch.
- This file is currently also imported in server components (`app/(main)/learn/[course]/layout.tsx`, `[slug]/page.tsx`, `quiz/page.tsx`, `app/admin/courses/page.tsx`, `app/components/Sidebar.tsx`). Risk that must be proven: `createBrowserClient` running on the server (no `document`) still queries public data as before. If not, branch on `typeof window` or give those server files a separate anon client — without changing their read behavior in H1.
- `proxy.ts` at the root + `lib/supabase.proxy.ts` (function `updateSession`): follow `C:\VocaSpace\proxy.ts` and `C:\VocaSpace\utils\supabase\middleware.ts` (only the part that refreshes the session with `getUser()` and sends signed-out visitors of `/admin/*` to `/login`; drop VocaSpace's teacher/profile/sign-in-reason parts). Do not add a `next`/redirect param (avoids open redirect).
- `lib/supabase.server.ts` stays as it is.

### 4.3 Server-side guard — `lib/auth.server.ts`

- `import "server-only"`.
- `getCurrentUser()`: `createSupabaseServerClient()` → `auth.getUser()`; returns `User | null`.
- `requireUser()`: throws / returns a standard error when not signed in.
- `requireAdmin()`: `requireUser()`, then read that user's `profiles.role` (with the user's own server client; RLS SELECT on profiles is public today). Do not trust `user_metadata`.
- A server action returns the error object in the type each action already returns (for example `{ error: "..." }`, `[]`, `null`) so the UI does not break; the helper should return a result of the form `{ user } | { error }` instead of throwing, so each action can map it to its existing return type.

### 4.4 Applying the guard to each action

| File | Action | Change |
|---|---|---|
| `admin-dashboard.ts` | all 4 functions | `requireAdmin()` at the top; on failure return the empty value of the current error branch (`null` / `[]`) |
| `payment.ts` | `getAllPayments`, `approvePayment`, `rejectPayment` | `requireAdmin()` |
| `payment.ts` | `createPendingPayment(courseId, userId, coupon)` | drop the `userId` parameter, take it from `requireUser()`; update the caller in `app/(main)/course/[slug]/page.tsx` |
| `payment.ts` | `updatePaymentWithCoupon`, `cancelPayment` | `requireUser()`; the UPDATE filters `.eq("id", paymentId).eq("user_id", user.id).eq("status", "pending")` together and `.select("id")`; check `error` and the number of returned rows, 0 rows → `{ error }` (A13). The earlier read (fetching `course_id` to compute the price) also filters by `user_id` |
| `payment.ts` | `confirmPaymentAndEnroll` | delete |
| `enroll.ts` | `enrollCourse(courseId, userId, price)` | change to `enrollCourse(courseId)`; user from `requireUser()`; only `course.price === 0`, otherwise return an error; update the caller |
| `user.ts` | `createNewUser`, `deleteUserAccount` | `requireAdmin()`. `createNewUser`: `password` required, ≥ 8 characters, drop the default `'123123'`; `role` accepts only `'user'` or `'admin'`; after `auth.admin.createUser`, if `role === 'admin'` update `profiles.role` with the service role (because the new trigger always writes `'user'`); an error in this step → delete the just-created user and return `{ error }` |
| `app/admin/users/page.tsx` | create-user form | add a password field (only when creating, not when editing), drop `password: "123123"` |
| `gemini.ts` | `generateQuizFromContent` | `requireAdmin()` |
| `email.ts` | `sendSuccessEmail` | move to `lib/email.server.ts` (no `"use server"`, with `import "server-only"`), delete `app/action/email.ts`; update the import in `payment.ts` |
| `get-notifications.ts` | `markAsRead` | keep as is (already uses the user's client + RLS; now works because the cookie exists) |

Delete `app/components/CoursePayment.tsx`. Remove the dependency `@supabase/auth-helpers-nextjs` if `grep` confirms nothing imports it.

### 4.5 Admin page guard

- Turn the current `app/admin/layout.tsx` (client) into `app/admin/AdminShell.tsx`, keeping the UI but dropping its own permission check.
- The new `app/admin/layout.tsx` is a server component: `requireAdmin()`; not signed in → `redirect('/login')`, not admin → `redirect('/')`; passes → render `<AdminShell>`.

## 5. Implementation checkpoints (Sonnet)

Each checkpoint is one local commit (English Conventional Commit). No push, no PR, no touching the hosted DB.

- **CP1** `fix(db): block role escalation via signup metadata and profile updates` — migration + rollback (4.1).
- **CP2** `fix(auth): move the Supabase session to cookies and refresh it in proxy` — 4.2.
- **CP3** `fix(auth): guard server actions and the admin layout on the server` — 4.3, 4.4, 4.5, delete dead code and the dependency.

CP2 includes the `next` allowlist and the PKCE handling in the callback; CP3 includes the required password and the atomic payment UPDATE.

After each checkpoint: `npx tsc --noEmit`; at the end of CP3: `npm run lint`, `npm run build`. Record the lint baseline before CP1 to compare.

## 6. Verification

Automated (Sonnet): typecheck, lint against the baseline, build.

After Main applies the migration (Owner approves), Main runs read queries on the hosted DB:
- `pg_get_functiondef` of the 3 functions and the new trigger match the migration file.
- Security advisors: the `function_search_path_mutable` warnings and the executable `handle_new_user` are gone.

Attack matrix (Main runs it on `npm run dev` at localhost in the browser pane, the Owner signs in to each test account; the DB is hosted, so act on test data only). Server actions are called directly with `fetch` and the `Next-Action` header taken from the network log, not through the UI:

| Check | Signed out | Regular user A | Admin |
|---|---|---|---|
| Each admin-only action (4.4) | error, no data change | error, no data change | works |
| `createPendingPayment` / `updatePaymentWithCoupon` / `cancelPayment` | error | works on A's order; on user B's `pending` order → error, B's order unchanged | — |
| `cancelPayment` / coupon on A's already `success` order | — | error, order unchanged | — |
| `enrollCourse(paid course id)` | error | error, no enrollment | — |
| `sendSuccessEmail` | no action ID left to call | — | — |
| supabase-js in the console: `signUp` with `data.role='admin'` | new role = `user` | — | — |
| supabase-js: `update`/`upsert` `profiles.role='admin'` for yourself | — | DB error | admin changes a test user's role → succeeds |
| `/auth/callback?next=javascript:alert(1)`, `?next=https://example.com`, `?next=//example.com` (with a valid code) | to `/` | — | — |
| `/auth/callback` with no code / a junk code | to `/auth/error`, existing session unchanged | to `/auth/error`, still A | — |
| A is signed in, opens B's recovery link in a browser other than the one B requested it from | — | to `/auth/error`, still A, does not reach the reset page | — |

"No data change" is confirmed by Main's read query on the test row after each call.

Manual QA (Owner, on hosted, test accounts):
1. Register a new account through the UI → role `user`; confirm the email through the new link.
2. Admin creates a new user: missing password / short password → blocked; create an admin with its own password → can sign in, has admin rights.
3. Sign in/out, forgot password → reset (open the link in the same browser). Open the link in another browser → a clear error message.
4. Free course: can enroll. Paid course: create an order → apply a coupon → cancel / admin approves → can learn.
5. Visit `/admin` signed out / as a regular user / as an admin.
6. Admin: dashboard, transactions, users (change role, create an admin user, delete a test user), courses/chapters/lessons CRUD, create a quiz with AI.
7. Learn a lesson, quiz, notes, comments, mark a notification as read.

The Owner checks the list of existing `role = 'admin'` accounts on hosted to be sure nobody exploited the hole, and changes the password of every account ever created through the admin page (password `123123`).

## 7. Risks

- The old localStorage session is lost → users must sign in again (accepted).
- `createBrowserClient` on the server (4.2) — must be proven.
- The role-blocking trigger distinguishes the calling role wrongly → it either blocks the admin/service role too (breaks A3) or blocks nothing (A2 fails). Must be proven by the SQL logic and QA steps 2 + 6.
- Deploy order: the migration can be applied before the code (it does not break the current app: admin role changes via the client still pass through `is_admin()`; the old `createNewUser` will create users with role `user` until the new code is deployed). The new code does not depend on the migration. Apply the migration as soon as possible after the review PASSes.

## Appendix A — old definitions (for writing the rollback)

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, phone, gender, role)
  VALUES (
    new.id, new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'gender',
    COALESCE(new.raw_user_meta_data->>'role', 'user')
  );
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
END;
$function$;
-- update_updated_at_column: chỉ bị thêm search_path; rollback = alter function ... reset search_path.
-- Đã xác minh: cả 3 function owner postgres, proconfig null,
-- proacl = {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}.
-- Rollback cho handle_new_user: grant execute ... to public, anon, authenticated.
```
