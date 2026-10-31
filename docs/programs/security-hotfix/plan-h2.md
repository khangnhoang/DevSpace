# Security hotfix — H2: block data exposure and impersonated writes

Progress: [progress.md](progress.md).
Risk level: High (RLS, column grant, coupon/payment, hosted DB) → Codex reviews the plan and the diff.
Split into 2 PRs, one branch each, done in sequence:

| PR | Branch | Scope |
|---|---|---|
| **H2-1** data exposure | `fix/h2-data-exposure` | P1 profiles PII, P2 public coupons, P13 paid lesson/quiz content |
| **H2-2** write integrity | `fix/h2-write-integrity` (cut from `main` after H2-1 merges) | P3 impersonated review, P4 comment `user_id` change, P5/P6 coupon usage, P25 non-atomic order approval |

The Owner split H2-2 into two parts (2026-10-22):
- **H2-2a**, P3 + P4 (review policy, `with_check` + comment trigger): small, low risk. Done when the work returns to security.
- **H2-2b**, P5/P6 + P25 (3 RPCs, `payments_guard`, deploy order, rollback): done after test-infra, once automated tests exist for the payment flow. The design in §4.3 stays as it is.

**Owner decisions (2026-10-22):**
- **D1** Coupon usage: **reserve a use when the code is applied**, release it on cancel / reject / switching codes. `max_uses` is a hard limit.
- **D2** Signing in with an unregistered email: **a generic message** "Email hoặc mật khẩu không đúng" (prevents email probing).

This plan lives on the H2-1 branch. H2-2 reuses the plan (no new plan) unless H2-1 changes the design.

## 1. Background (verified 2026-10-21)

Sources: code on `main` @ `5c842d4` (after H1) and the metadata of the hosted DB `lkvxxrxojjlkchzzqidu` (`pg_policies`, `pg_constraint`, `information_schema.columns`). No data rows were read, except a count of lessons containing `import`/`export` (0/80).

1. **P1 — `profiles` is publicly readable.** The policy `"Public profiles are viewable by everyone"` (SELECT, `public`, `true`). Anon can read `email, phone, dob, gender, province, role` of everyone. On top of that, `app/(main)/login/page.tsx:46` `checkEmailExists` uses this same hole to report "email not registered / already used" (email probing).
   Places that need other people's public data (only `full_name, avatar_url`, and `role` for the admin badge):
   - course reviews: `app/(main)/course/[slug]/page.tsx:70` embeds `profiles(full_name, avatar_url)`
   - comments: `lib/supabase.ts:1010` embeds `profiles(full_name, avatar_url, role)`
   - instructors: `lib/supabase.ts:571` (`getFullCourseDetail`) and `:266` (`getInstructors`) embed through `instructors.user_id → profiles`
   Other places read only the user's own profile (Header, HeaderAdmin, finish page, `getProfile`, `requireAdmin`) or run with the service role / admin pages (`is_admin()`).
2. **P2 — `coupons` is publicly readable.** The policy `"Public can view active coupons"` (`true`). `CoursePaymentModal.tsx:51-69` reads the coupons table directly on the client, then recomputes the price a second time after `updatePaymentWithCoupon` has already computed it on the server.
3. **P13 — paid content readable without enrolling.**
   - `lessons` and `exercises` have a SELECT policy `true` for `public`. Anon can get `lessons.content`, `video_url`, and all questions + `correct_answer` through REST.
   - `app/(main)/learn/[course]/[slug]/page.tsx` is a server component using the `supabase` from `lib/supabase.ts` (a browser client → anon on the server), `select("*")` by slug, renders MDX on the server and only then lets `LearnClient` check enrollment on the client. The content is already in the RSC payload (seen while checking next-mdx-remote v6: `h1/h3/p/ul` in the HTML when signed out).
   - The quiz page `.../quiz/page.tsx` is similar: it fetches exercises with `correct_answer` without sign-in.
   - The page fetches the lesson by a global `slug` and does not check that `lesson.course_id` matches `[course]` in the URL.
   - Lesson metadata (`id, title, slug, course_id, chapter_id, order_index, created_at`) must stay public: the course outline, the sidebar, the profile dashboard, computing the next lesson.
   - Two places read `video_url`/`content` only to display metadata, for every visitor: `getLessonsByCourse` (`lib/supabase.ts:53`, sidebar: `video_url`) and `getFullCourseDetail` (`lib/supabase.ts:605`, public course page: `video_url, content` to estimate duration with `estimateTime` and label video/reading). The course page is a client component → **every visitor downloads the full content of every lesson** of the course.
4. **P3 — impersonated review.** The INSERT on `reviews` only checks the enrollment of `auth.uid()` and does not constrain `user_id = auth.uid()` → an enrolled user writes a review carrying someone else's `user_id`. There is `UNIQUE (user_id, course_id)` → this can also block the real person from reviewing later. The client uses `upsert` (`course/[slug]/page.tsx:161`).
5. **P4 — comment moved to another lesson / changed owner.** UPDATE on `comments` has `qual = auth.uid() = user_id OR admin`, `with_check = null`. Postgres uses `USING` as the condition for the new row when `WITH CHECK` is missing (Codex r1) → a regular user can **not** change `user_id` to someone else; but they can still move the comment to a different `lesson_id`, and an admin can change `user_id`. Low severity; still fixed with an explicit `WITH CHECK` + an immutability trigger so it does not rely on implicit behavior.
   INSERT on `comments` already has `with_check auth.uid() = user_id` → no impersonation on create.
6. **P5/P6 — coupon usage.** `increment_coupon_usage` does not exist. The UI never passes a coupon to `createPendingPayment`; a coupon is applied only through `updatePaymentWithCoupon`, which does not count usage → `used_count` never increases and `max_uses` is meaningless. `payments` does not store which coupon was applied. `finalAmount` can be fractional (the column is `integer`).
7. **Other metadata read (Codex r1 asked for it):**
   - RLS is on for every `public` table. There are no views in `public`. Functions: `handle_new_user`, `is_admin` (definer), `prevent_role_escalation`, `update_updated_at_column` (invoker).
   - `payments`: only has a SELECT policy for the own rows → the client cannot INSERT/UPDATE/DELETE (every write goes through the service role).
   - `coupons`: only the SELECT policy `true` → the client cannot write.
   - `enrollments`: INSERT only locks `price = 0` and `user_id = auth.uid()`; SELECT own rows; `UNIQUE (user_id, course_id)`.
   - **Default ACL of `public`** (`pg_default_acl`): new tables/views automatically get `arwdDxtm` for `anon`, `authenticated`; new functions automatically get `EXECUTE` for `anon`, `authenticated`. → Every new view/function must `revoke` explicitly.
   - Existing coupons: 3 codes, none has `max_uses` null. Existing `pending` orders: 0.
8. **P25 (new) — approving/rejecting an order is not atomic.** `approvePayment` (`payment.ts:213`) and `rejectPayment` (`:312`) UPDATE only by `id`, not `status = 'pending'` → approving again an order that was cancelled/approved, sending the email again. Only an admin can call it (after H1), so the severity is low, but H2-2 needs it atomic to count a coupon exactly once.

## 2. Goals and acceptance criteria

### H2-1
- **B1** Anon and regular users cannot read other people's `email, phone, dob, gender, province` through REST (`/rest/v1/profiles`). A user can still read/update their full own profile; an admin can still read every profile.
- **B2** Name/avatar/admin badge still show correctly in reviews, comments, instructors.
- **B3** Anon/users cannot list coupons through REST. Applying a valid code still changes the price; a wrong/exhausted code shows a Vietnamese error.
- **B4** Anon and users who have not enrolled cannot get `lessons.content`, `lessons.video_url` through REST, and the `/learn/...` page does not send the lesson content in the HTML/RSC payload to them.
- **B5** Anon and users who have not enrolled cannot read `exercises` (questions or answers) through REST or the quiz page.
- **B6** An enrolled user (free course or approved) and an admin can learn/take quizzes normally; the course outline, sidebar and progress dashboard stay correct.
- **B7** The admin lesson page can still view/edit `content`.
- **B8** Registering with an existing email still shows "Email này đã được sử dụng"; there is no more `profiles` query by email from the client.
- **B9** There is no moment between deploying the code and applying the migration when production breaks (see §5).

### H2-2
- **B10** A review cannot be created/updated with `user_id ≠ auth.uid()`.
- **B11** A comment owner cannot change the comment's `user_id` (and `lesson_id`); an admin can still soft-delete.
- **B12** (D1) Applying a code successfully holds 1 use (`used_count` +1) and stores `payments.coupon_id`; applying the same code again costs no extra use; switching to another code releases the old code's use; cancelling or rejecting an order releases the use; approving does not change `used_count`. Approving/rejecting an already processed order is blocked.
- **B13** An exhausted coupon (`used_count >= max_uses`) is rejected on apply, even when two people apply at the same moment for the last use (only one succeeds).

## 3. Out of scope

- The quiz is graded on the client and receives `correct_answer` (an enrolled user can see the answers) → **P26**, done together with P20 (store quiz results, grade on the server).
- Comments: the content of a soft-deleted comment is still readable through REST; a user who has not enrolled can still read/write comments on a paid lesson → **P27**.
- `profiles` UPDATE: a user can edit the `email` column in profiles themselves (does not affect sign-in; system email is sent to `profiles.email`) → **P28**.
- The "learn in order" check (`isAllowed` in `LearnClient`) stays on the client — this is UX, not authorization.
- P7 in general (every server component reading with anon) — H2-1 fixes only the learn/quiz/layout pages.

## 4. Design

### 4.1 H2-1 — DB, split into 2 migrations for a safe deploy

**Migration A (additive, breaks nothing)** `supabase/migrations/<ts>_h2_1a_public_profile_view.sql`:

```sql
-- Public projection of profiles: only what other users may see.
create view public.profile_cards as
  select id, full_name, avatar_url, role from public.profiles;
-- Owner = postgres, security_invoker off: reads bypass profiles RLS on purpose.
-- A simple view is auto-updatable and the schema's default ACL grants
-- INSERT/UPDATE/DELETE on new relations to anon/authenticated: without this
-- revoke, writes through the view would hit profiles as postgres, bypassing RLS.
revoke all on public.profile_cards from public, anon, authenticated;
grant select on public.profile_cards to anon, authenticated;
```

- **Check right after applying A** (Codex r1 blocker): `POST`, `PATCH`, `DELETE /rest/v1/profile_cards` by anon and a regular user are all rejected (42501); `information_schema.table_privileges` of the view shows only `SELECT` for the 2 roles.

```sql
-- Public lesson metadata derived from the private columns, so outlines and
-- duration estimates no longer need content or video_url.
alter table public.lessons
  add column has_video boolean
    generated always as (coalesce(video_url, '') <> '') stored,
  add column word_count integer
    generated always as (
      case when coalesce(content, '') = '' then null
           else array_length(regexp_split_to_array(
                  btrim(regexp_replace(content, '<[^>]*>?', '', 'g')), '\s+'), 1)
      end) stored;
```

- `word_count` matches the current `estimateTime` (strip HTML tags, split on whitespace). `estimateTime` changes signature to `(wordCount: number | null, hasVideo: boolean)`; `null` → 60 seconds as before.
- Adding stored columns rewrites the table (80 rows) — negligible. The current grant is at table level, so anon/authenticated can read the 2 new columns immediately.
- The advisor will report `security_definer_view` (0010) — accepted on purpose, noted in the migration. The alternative (a table synced by a trigger) is more complex than needed.
- PostgREST infers the view's relationships from the base table's FKs (`reviews.user_id → profiles.id`, `comments.user_id → profiles.id`, `instructors.user_id → profiles.id`) → `profile_cards(...)` can be embedded. **Must be checked right after applying A** with 3 REST requests (§6). If the embed cannot be inferred: switch to 2 queries (fetch the `user_id` list, then `in()` into the view), and record it in the plan.

**Migration B (narrow the permissions)** `supabase/migrations/<ts>_h2_1b_restrict_reads.sql` — applied only after the H2-1 code is in production:

```sql
-- P1: profiles — only self or admin.
-- Plain auth.uid(), no (select ...): a sublink here makes the admin UPDATE/DELETE
-- policies on profiles (which subquery profiles) fail with 42P17 recursion.
drop policy "Public profiles are viewable by everyone" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- P2: coupons — no client reads at all (server uses service role).
drop policy "Public can view active coupons" on public.coupons;

-- P13: lessons — rows stay public, content columns do not.
revoke select on public.lessons from anon, authenticated;
grant select (id, title, slug, course_id, chapter_id, order_index, created_at,
               has_video, word_count)
  on public.lessons to anon, authenticated;

-- P13: exercises — enrolled learners of the lesson's course, or admin.
drop policy "Public view exercises" on public.exercises;
create policy "exercises_select_enrolled_or_admin" on public.exercises
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.lessons l
      join public.enrollments e on e.course_id = l.course_id
      where l.id = exercises.lesson_id
        and e.user_id = (select auth.uid())
    )
  );
```

- **Do not use `(select auth.uid())` in the `profiles` policy (Codex, confirmed by Main):** a sublink in the SELECT policy of `profiles` makes Postgres report `42P17 infinite recursion detected in policy for relation profiles` when it rewrites the admin UPDATE/DELETE policies (those two policies subquery `profiles` itself) → every profile UPDATE/DELETE breaks, including a user editing their own profile. Use a bare `auth.uid()`. The `exercises` policy keeps the sublink because it only reads `lessons`/`enrollments`.
- The current `lessons` grant (already read): `anon` and `authenticated` have table-level `SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE` (Supabase default), with no per-column grants. `revoke select` removes only SELECT. (`TRUNCATE`/`TRIGGER` for clients is the Supabase default, RLS still blocks writes — out of scope.)
- `lessons` UPDATE/INSERT/DELETE keep their grants (admin edits through the client still work; an UPDATE filtered by `id` only needs SELECT on `id`).
- The auxiliary exercises policy runs with the caller's rights: it needs SELECT on `lessons.id, lessons.course_id` (present) and the `enrollments` RLS (own rows only — enough).
- Rollback: `supabase/rollbacks/<ts>_h2_1b_restrict_reads.down.sql` restores exactly the 3 old policies + the old grant (old definitions in Appendix A). Rollback of A: `drop view public.profile_cards`.

### 4.2 H2-1 — code

**Shared service-role client.** Add `lib/supabase.admin.ts` (`import "server-only"`, exports `supabaseAdmin`). Used only in new/changed H2 files; the existing `createClient` calls in `app/action/*` need not be replaced (to keep the PR small).

**Learn page `app/(main)/learn/[course]/[slug]/page.tsx`** — gate on the server before reading content:
1. `getCurrentUser()`; none → `redirect("/login")`.
2. Read the lesson metadata by `slug` + the course by `[course]` with `createSupabaseServerClient()` (public columns). Missing, or `lesson.course_id ≠ course.id` → `<NotFoundLesson />`.
3. Permission: the user's enrollment for `course.id` (server client, RLS returns only their own rows) **or** admin (read their own `profiles.role`). Neither → `redirect(\`/course/${course}\`)`.
4. Only after step 3 read `content, video_url` with `supabaseAdmin` by `lesson.id`.
5. `LearnClient` (Codex r1): **remove** the client-side sign-in/enroll check (`LearnClient.tsx:61-80`) — it sends an admin who has not enrolled back to `/`, contrary to B6. The server passes a prop `isAdmin`; the "learn in order" check stays for learners and is skipped when `isAdmin`. The quiz page has no similar client check → it only needs the server gate.
Package steps 1–3 as a server-only helper `requireCourseAccess(courseSlug)` in `lib/auth.server.ts` returning `{ user, course } | { redirect: string }`, shared by the learn page and the quiz page.

**Quiz page `.../quiz/page.tsx`** — uses the same helper; exercises are read with the server client (the new RLS allows it because the user is enrolled / admin). The grading method does not change (P26).

**Metadata instead of the private columns:**
- `getLessonsByCourse`: `video_url` → `has_video`; the type `lessonBasic` and its users (`LearnClient`, sidebar) change accordingly. The `videoId` of the lesson being learned still comes from step 4 above.
- `getFullCourseDetail`: drop `video_url, content`, use `has_video, word_count` for `type` and `estimateTime`; drop the `video_url` field from the returned object (and from the type if nobody reads it).

**`getLessonsByCourse` (`lib/supabase.ts:39`)** — takes an optional `client` parameter (default the current `supabase`). The layout `learn/[course]/layout.tsx`, the learn page and the quiz page pass the server client so `exercises(count)` (the `has_exercise` flag) is correct for an enrolled user. On the public page (not enrolled) `has_exercise` will be `false` after Migration B — accepted.

**No more reading `lessons.*`/`content`/`video_url` with anon/authenticated.** Grep all `from("lessons")` and the embeds `lessons(` / `lessons (`:
- `getLessons()` (`lib/supabase.ts:377`, admin lessons page, reads `content`) → change to a server action `getLessonsForAdmin()` in `app/action/` with `requireAdmin()` + service role; `app/admin/lessons/page.tsx` calls this action.
- Any `select("*")` on lessons or embed `lessons(*)` from the client → list specific columns.
- Any other place that reads `content` (for example AI quiz creation) must run on the server with the service role after `requireAdmin()` — check while grepping.

**Public profile** — change 4 embeds to `profile_cards(...)`, keeping the field names the UI reads through an alias so components need no change: `profiles:profile_cards(full_name, avatar_url)` (review), `profiles:profile_cards(full_name, avatar_url, role)` (comment), `profiles:profile_cards(full_name, avatar_url)` (`getFullCourseDetail`), `profiles:profile_cards(full_name)` (`getInstructors`). Grep `profiles(` / `profiles (` again so none is missed.

**Sign-up / sign-in (`login/page.tsx`)** — remove `checkEmailExists`:
- Sign-up: after `supabase.auth.signUp`, if `data.user && data.user.identities?.length === 0` → "Email này đã được sử dụng. Vui lòng chọn email khác hoặc đăng nhập." (Supabase's behavior when the email already exists and email confirmation is on). The check at `registerStep` 1 goes away; the message moves to after the form is submitted.
- Sign-in (D2): drop the message "Email này chưa được đăng ký"; sign-in errors use the generic message "Email hoặc mật khẩu không đúng".

**Coupon (`CoursePaymentModal.tsx`)** — remove the `coupons` query and the client-side price computation. `updatePaymentWithCoupon` additionally returns `discountPercent` and distinguishes Vietnamese errors: "Mã giảm giá không tồn tại hoặc đã hết hạn" / "Mã này đã hết lượt sử dụng". Check exhaustion only when `max_uses !== null` (null = unlimited; in JS `n >= null` becomes `n >= 0` → wrongly rejects). The modal shows only the server result. `finalAmount` is rounded with `Math.round`.

### 4.3 H2-2 — DB `supabase/migrations/<ts>_h2_2_write_integrity.sql`

```sql
-- P3: reviews are written only as yourself.
drop policy "Only enrolled students can review" on public.reviews;
create policy "reviews_insert_own_enrolled" on public.reviews
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.enrollments e
                where e.user_id = (select auth.uid()) and e.course_id = reviews.course_id)
  );
-- ("Auth update own reviews" already has with_check user_id = auth.uid().)

-- P4: comment owner/admin may update, but the owner cannot reassign it.
alter policy "Owners and Admins can update/soft-delete comments" on public.comments
  with check ((select auth.uid()) = user_id or public.is_admin());
create function public.prevent_comment_reassign() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id or new.lesson_id is distinct from old.lesson_id then
    raise exception 'comment owner and lesson are immutable' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger comments_prevent_reassign before update on public.comments
  for each row execute function public.prevent_comment_reassign();

-- P5/P6 (D1): a pending payment reserves one coupon use; cancel/reject releases it.
alter table public.payments
  add column coupon_id bigint references public.coupons(id) on delete restrict;  -- coupons with history are deactivated, not deleted

-- Apply (or switch) a coupon on the caller's pending payment, atomically.
create function public.apply_payment_coupon(p_payment_id bigint, p_user_id uuid, p_code text)
  returns table (amount integer, discount_percent integer, error text)
  language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments;
  v_coupon public.coupons;
  v_price integer;
begin
  -- Tell payments_guard this write comes from a payment RPC (tx-local).
  perform set_config('app.payment_rpc', 'on', true);
  select * into v_pay from public.payments
   where id = p_payment_id and user_id = p_user_id and status = 'pending'
   for update;
  if not found then return query select null::int, null::int, 'invalid_payment'; return; end if;

  select * into v_coupon from public.coupons
   where code = upper(p_code) and is_active;
  if not found then return query select null::int, null::int, 'invalid_coupon'; return; end if;

  select price into v_price from public.courses where id = v_pay.course_id;

  if v_pay.coupon_id is distinct from v_coupon.id then
    -- Lock the old and new coupon rows in id order so two payments switching
    -- M->N and N->M at once cannot deadlock.
    perform 1 from public.coupons
      where id in (v_coupon.id, v_pay.coupon_id)
      order by id
      for update;
    -- Reserve a use on the new coupon only if one is left.
    update public.coupons set used_count = used_count + 1
     where id = v_coupon.id and (max_uses is null or used_count < max_uses);
    if not found then return query select null::int, null::int, 'coupon_exhausted'; return; end if;
    -- Release the previously applied coupon, if any.
    if v_pay.coupon_id is not null then
      update public.coupons set used_count = greatest(used_count - 1, 0) where id = v_pay.coupon_id;
    end if;
  end if;

  update public.payments
     set coupon_id = v_coupon.id,
         amount = greatest(0, round(v_price * (100 - v_coupon.discount_percent) / 100.0))::int,
         updated_at = now()
   where id = v_pay.id
   returning payments.amount into v_price;
  return query select v_price, v_coupon.discount_percent, null::text;
end $$;

-- Close a pending payment as failed and release its coupon. p_user_id null = admin reject.
create function public.close_pending_payment(p_payment_id bigint, p_user_id uuid)
  returns boolean
  language plpgsql security definer set search_path = '' as $$
declare v_coupon_id bigint;
begin
  -- Tell payments_guard this write comes from a payment RPC (tx-local).
  perform set_config('app.payment_rpc', 'on', true);
  update public.payments set status = 'failed', updated_at = now()
   where id = p_payment_id and status = 'pending'
     and (p_user_id is null or user_id = p_user_id)
   returning coupon_id into v_coupon_id;
  if not found then return false; end if;
  if v_coupon_id is not null then
    update public.coupons set used_count = greatest(used_count - 1, 0) where id = v_coupon_id;
  end if;
  return true;
end $$;

-- Approve a pending payment and grant the enrollment in one transaction.
-- The reserved coupon use (if any) simply stays counted. Returns an explicit
-- jsonb result: a composite return type comes back from PostgREST as an
-- object of nulls instead of null (Codex r2).
create function public.approve_payment(p_payment_id bigint)
  returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare v public.payments;
begin
  perform set_config('app.payment_rpc', 'on', true);
  update public.payments set status = 'success', updated_at = now()
   where id = p_payment_id and status = 'pending'
   returning * into v;
  if not found then return jsonb_build_object('approved', false); end if;
  insert into public.enrollments (user_id, course_id)
  values (v.user_id, v.course_id)
  on conflict (user_id, course_id) do nothing;
  return jsonb_build_object('approved', true, 'payment_id', v.id,
                            'user_id', v.user_id, 'course_id', v.course_id);
end $$;

-- Guard: amount, status and coupon_id are written only by the RPCs above.
-- Service role bypasses RLS but not triggers, so old or future code that
-- writes payments directly fails loudly instead of desyncing used_count.
--   INSERT: a new payment must be a plain pending order at the course price.
--   UPDATE OF amount, status, coupon_id: rejected outright without the GUC,
--   even when re-assigning the same value (old approve re-sets 'success').
create function public.payments_guard() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare v_price integer;
begin
  if current_setting('app.payment_rpc', true) is not distinct from 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    select price into v_price from public.courses where id = new.course_id;
    if new.status <> 'pending' or new.coupon_id is not null
       or new.amount is distinct from v_price then
      raise exception 'new payments must be pending, at course price, without coupon' using errcode = '42501';
    end if;
    return new;
  end if;
  raise exception 'payments amount/status/coupon_id must be changed through payment RPCs' using errcode = '42501';
end $$;
create trigger payments_guard_insert before insert on public.payments
  for each row execute function public.payments_guard();
create trigger payments_guard_update before update of amount, status, coupon_id on public.payments
  for each row execute function public.payments_guard();

-- Preflight in the same transaction: once the guard exists the old discount
-- path cannot run, so this check cannot go stale (Codex r2).
do $$
begin
  if exists (select 1 from public.payments p join public.courses c on c.id = p.course_id
             where p.status = 'pending' and p.amount < c.price) then
    raise exception 'pending discounted payments without coupon_id exist: ask the Owner before applying H2-2';
  end if;
end $$;

revoke execute on function public.apply_payment_coupon(bigint, uuid, text) from public, anon, authenticated;
revoke execute on function public.close_pending_payment(bigint, uuid) from public, anon, authenticated;
revoke execute on function public.approve_payment(bigint) from public, anon, authenticated;
revoke execute on function public.payments_guard() from public, anon, authenticated;
```

- `approve_payment` (Codex r1): the status and the enrollment commit together or roll back together — there is no more case of a `success` order without learning rights. Approving in parallel with cancel/reject: both run an UPDATE conditional on `status = 'pending'` on the same row, so Postgres serializes them and only one side wins.
- **Old discounted orders (Codex r1, r2):** the final `do $$` block counts pending orders with `amount < price` (discounted through the old flow, without `coupon_id`) **in the same transaction that creates `payments_guard`** → there is no gap between the check and the block. It is 0 now. If > 0 the migration aborts itself; Main reports to the Owner, who chooses to reject each order or allow an exception.
- **`payments_guard` (Codex r2, r3):** besides the 3 RPCs, (a) INSERT may only create a `pending` order at the locked price with `coupon_id` null — this blocks the old `createPendingPayment(courseId, couponCode)` (still directly callable even though the UI does not pass it); (b) every UPDATE with `amount`/`status`/`coupon_id` in the SET list is blocked, even re-assigning the same value — this blocks the old approve action from approving an already `success` order again and sending an email. The trigger also runs for the service role. The GUC `app.payment_rpc` can be set only inside a DB session: a REST client has no way to set it (PostgREST does not allow arbitrary GUCs; `set_config` is not exposed because `public` has no wrapper for it), and the service role is already the highest privilege. Consequence: from applying the migration until the new code is live, the old code's payment operations (apply code, cancel, approve, reject) **report errors instead of skewing `used_count`** — a few minutes of disruption is accepted. `updated_at` and other columns can still be edited.

- **D1 — reserve on apply.** `FOR UPDATE` on the payment blocks two parallel applies on the same order; the conditional UPDATE `used_count < max_uses` blocks two orders racing for the last use (Postgres locks the coupon row, the second one re-evaluates the condition after the first commits).
- Approving an order **does not** change `used_count` (the use was reserved when applied) — it only needs the atomic UPDATE `status = 'pending' → 'success'` (§4.4).
- An abandoned pending order holds its use until it is cancelled/rejected — accepted (an admin rejects stale orders to release the use). Old pending orders that exist before the migration have `coupon_id = null` → release no use, which is correct because they were never counted.
- `max_uses` is currently an `integer` that can be null → treat null as unlimited.
- Both functions are called only by the service role (revoked from clients); server actions still run `requireUser`/`requireAdmin` before calling and pass `user.id` from the session, not from the client. The trigger `prevent_comment_reassign` is INVOKER and also blocks the service role — accepted (no legitimate flow changes a comment's owner).

### 4.4 H2-2 — code

- `updatePaymentWithCoupon`: `requireUser()` then `rpc("apply_payment_coupon", { p_payment_id, p_user_id: user.id, p_code })`; map errors: `invalid_payment` → "Đơn hàng không hợp lệ", `invalid_coupon` → "Mã giảm giá không tồn tại hoặc đã hết hạn", `coupon_exhausted` → "Mã này đã hết lượt sử dụng". Returns `{ newAmount, discountPercent }` (H2-1 already changed the modal to use these 2 fields).
- `createPendingPayment`: drop the `couponCode` parameter and the branch calling `increment_coupon_usage` (no caller passes it).
- `cancelPayment`: `rpc("close_pending_payment", { p_payment_id, p_user_id: user.id })`; `false` → "Không thể hủy giao dịch này".
- `rejectPayment` (`payment.ts:312`, currently UPDATE by `id` only): `requireAdmin()` then `rpc("close_pending_payment", { p_payment_id, p_user_id: null })`; `false` → "Đơn đã được xử lý".
- `approvePayment`: `requireAdmin()` then `rpc("approve_payment", { p_payment_id })`; `data?.approved !== true` → "Đơn đã được xử lý", no email. Email + notification are sent only when `approved === true` (already committed), using the `user_id`/`course_id` in the result. Remove the separate enroll block that exists now (`payment.ts:241-254`).
- Review/comment: no code change (the client already sends its own `user_id`).

## 5. Rollout order and checkpoints

**H2-1** (Sonnet on `fix/h2-data-exposure`, Main applies the migration after the Owner approves):
1. **CP1** — write Migration A + rollback; change 4 embeds to `profile_cards`. Main applies A and checks the embeds with REST (§6). If the embed breaks → the 2-query option before going on.
2. **CP2** — `lib/supabase.admin.ts`, `requireCourseAccess`, learn page, quiz page, layout, `getLessonsByCourse(client)`, `getLessonsForAdmin`, drop every `content`/`*` read of lessons from the client.
3. **CP3** — sign-up/sign-in drop `checkEmailExists`; coupon modal + `updatePaymentWithCoupon`.
4. **CP4** — write Migration B + rollback (do not apply). Main reviews the diff, Codex reviews the diff.
5. Merge + deploy the H2-1 code (works with the old DB because A is there and B is not). Basic production check.
6. Main applies B (Owner approves), reruns the §6 matrix on production/localhost.

**H2-2** (new branch from `main` after step 6): migration + code in the same PR.
1. The Owner picks a time with few purchases (a few minutes of payment operations will report errors).
2. Apply the migration. The preflight in the migration aborts itself if an old discounted order exists. From here `payments_guard` blocks every payment write path of the old code (including a discounted INSERT) → no reservation is broken, no new discounted order lacks a `coupon_id` (Codex r2).
3. Merge + deploy the H2-2 code. Old requests still running (including through Skew Protection if enabled) only get errors, they do not write wrongly.
4. Run the §6 H2-2 matrix and the reconciliation query (below).

**Rollback H2-2** (Codex r1, r2) — rollback means returning to the behavior before H2-2, where `max_uses` is **not** enforced; D1 cannot be kept after a rollback, and the Owner accepts that when deciding to roll back.
0. Block new reservations at the DB first (Codex r3): `revoke execute on function public.apply_payment_coupon(bigint, uuid, text) from service_role;` — new calls are rejected, running calls finish by themselves (check `pg_stat_activity` has no `apply_payment_coupon` query left). `approve_payment` and `close_pending_payment` keep running to process orders.
1. While the H2-2 code is still running: an admin processes every pending order that has a `coupon_id` (approve or reject through the RPC) so no reservation is left hanging; check `select count(*) from payments where status = 'pending' and coupon_id is not null` = 0.
2. Revert the code to H2-1. The guard is still there → old code touching payments will report errors, not write wrongly.
3. Right after, apply `supabase/rollbacks/<ts>_h2_2_write_integrity.down.sql`: drop `payments_guard` and the 3 RPCs; keep the column `coupon_id` (history, ignored by the old code); restore the old reviews/comments policies if the reason for the rollback lies there.
4. Reconciliation runs only when the writers have stopped (between steps 2 and 3, with the guard blocking), to record the numbers rather than to maintain D1:
   ```sql
   select c.code, c.used_count,
          (select count(*) from public.payments p
            where p.coupon_id = c.id and p.status in ('pending', 'success')) as reserved
   from public.coupons c;
   ```
   While H2-2 is running, `used_count = reserved` is an invariant — this query is also used for #29.

## 6. Verification

Tools: curl to REST with the anon key and the access token of a test user (the Owner signs in in the browser pane; Main takes the token from that session's cookie), as in H1. SQL is read-only unless the Owner approves.

**After Migration A:** REST `reviews?select=id,profiles:profile_cards(full_name)`, `comments?select=id,profiles:profile_cards(full_name,role)`, `courses?select=id,instructors(profiles:profile_cards(full_name))` return names.

**H2-1 matrix (after B):**

| # | Who | Action | Expected |
|---|---|---|---|
| 1 | anon | `GET /profiles?select=email,phone` | `[]` |
| 2 | user A | `GET /profiles?select=email&id=neq.<A>` | `[]`; `id=eq.<A>` returns A's |
| 3 | admin | `GET /profiles?select=email` | every row |
| 4 | anon | `GET /profile_cards?select=*` | only the 4 public columns |
| 5 | anon, user A | `GET /coupons` | `[]` |
| 6 | anon | `GET /lessons?select=content` | error 42501 (permission denied for column) |
| 7 | anon | `GET /lessons?select=id,title,slug,has_video,word_count` | returns data |
| 7b | anon | open `/course/<X>` | duration, video/reading label as before; the network has no `content`/`video_url` |
| 8 | user A not enrolled in course X | `GET /exercises?lesson_id=eq.<lesson of X>` | `[]` |
| 9 | user A enrolled in course X | as #8 | has questions |
| 10 | anon | `curl /learn/<X>/<lesson>` | 307 → `/login`, the HTML does not contain the lesson content |
| 11 | user A not enrolled | open `/learn/<X>/<lesson>` | back to `/course/<X>`, the payload has no content |
| 12 | user A | `/learn/<another course>/<lesson of X>` (course mismatch) | NotFound |
| 13 | user A enrolled / admin | learn a lesson, the sidebar has the quiz flag, take the quiz | normal |
| 14 | admin | `/admin/lessons` view/edit content | normal |
| 15 | — | register with an existing email | "Email này đã được sử dụng" |
| 16 | user A | apply a correct / wrong / exhausted coupon | price changes / 2 Vietnamese error messages |
| 17 | anon | reviews/comments/instructors on the course page | show name, avatar, admin badge |
| 17b | anon, user A | `POST`/`PATCH`/`DELETE /profile_cards` | 42501 (check right after A) |
| 17c | admin not enrolled in course X | open X's lesson + quiz | gets in, is not pushed back to `/` |
| 17d | user A | coupon with `max_uses` null (created temporarily) | can be applied |
| 17e | anon | `POST /graphql/v1` query `lessonsCollection { edges { node { content } } }` and `profilesCollection { ... email }` | permission error / empty like REST |
| 17f | user A not enrolled | view the RSC payload of the quiz page (`curl` with cookie) | no questions/answers |
| 17g | user A | edit their own profile (`/profile` page, function `updateProfile`) | succeeds, no 42P17 error |
| 17h | admin | edit another user's profile | succeeds, no 42P17 error |
| 17i | admin | `DELETE /rest/v1/profiles?id=eq.<temporary account>` with an admin JWT (the admin UI deletes through the service role, so the policy cannot be checked there) | deletes, no 42P17 error; if skipped, say so explicitly |

**H2-1 results (2026-10-22, production, after B `20261021185249`):**
- **Passed (anon/REST/GraphQL):** 1, 4, 5, 6, 7, 7b, 8, 10, 17, 17b, 17e.
- **Passed (SQL simulating user/admin, rolled back):** 2, 3, 9. `EXPLAIN UPDATE/DELETE` has no 42P17 error.
- **Passed (UI, user `student`):** 11, 12, 13 (the javascript course has no quiz; a learn-in-order course still blocks), 15 (no new user created), 16, 17d (temporary code `MADUNG50`, deleted; orders 88/89 cancelled), 17f.
- **Passed (UI, `admin` enrolled only in reactjs):** 14 (PATCH lessons 204, md5 of content unchanged), 17c (html-css lesson + quiz), 17h (PATCH profiles 204).
- **Not passed because of an old bug:** 17g. PATCH 400 `invalid input syntax for type date: ""` (P16); the error happens after the RLS step so it is not caused by B.
- **Skipped:** 17i. There is no temporary account; checked with `EXPLAIN DELETE`.

**H2-2 matrix:**

| # | Who | Action | Expected |
|---|---|---|---|
| 18 | enrolled user A | `POST /reviews` with `user_id = B` | 42501 |
| 19 | user A | `PATCH /comments?id=eq.<A's>` setting `user_id = B` | error (RLS or trigger) |
| 20 | admin | soft-delete A's comment | succeeds |
| 21 | user A | apply code M to a pending order | `used_count(M)` +1, `payments.coupon_id = M` |
| 21b | user A | apply M again | `used_count(M)` unchanged |
| 21c | user A | switch to code N | `N` +1, `M` −1 |
| 21d | user A | cancel the order / admin rejects the order | the applied code −1, order `failed` |
| 21e | admin | approve an order with a code | `used_count` unchanged, order `success` |
| 21f | 2 users | apply at the same time a code with 1 use left (2 parallel requests) | exactly 1 succeeds, `used_count = max_uses` |
| 22 | admin | approve/reject again an already processed order | "Đơn đã được xử lý", `used_count` unchanged, no email |
| 23 | anon, user | `POST /rpc/apply_payment_coupon`, `/rpc/close_pending_payment`, `/rpc/approve_payment`, `/rpc/payments_guard` | 42501 / 404 |
| 23b | admin | `approve_payment` with a non-existent id / an already processed order — look at the real REST body | `{"approved": false}`, no email |
| 23c | service role | `PATCH /payments` setting `status`/`amount` directly, including re-assigning `status = 'success'` on an approved order (simulating old code) | 42501 from `payments_guard`; only `updated_at` is allowed |
| 23d | service role | `POST /payments` with `amount < price` or with `coupon_id` (simulating the old `createPendingPayment` with a coupon) | 42501; `POST` of a pending order at the right price still works |
| 23e | service role | `DELETE /coupons?id=eq.<H2TEST>` when an order already references it | FK error 23503, does not touch the guard |
| 23f | — | rollback step 0: revoke `apply_payment_coupon` from service_role then call the apply-code action | error, no reservation created; cancel/approve still run (check on a Supabase branch, or skip if not rolling back for real) |
| 24 | user A | `updatePaymentWithCoupon` on B's order | "Đơn hàng không hợp lệ" |
| 25 | 2 users | switch codes in opposite directions at the same time (order 1: M→N, order 2: N→M) | both finish, no deadlock, total `used_count` correct |
| 26 | admin | approve an order → the enrollment exists immediately; approve an order of a user already enrolled | succeeds, no duplicate error |
| 27 | admin + user | approve and cancel the same order at the same time | exactly one side wins; if approve wins there is an enrollment |
| 28 | user A | direct REST: `PATCH /payments` (amount/status/coupon_id), `PATCH /coupons` (used_count), `POST /enrollments` for a paid course, `PATCH /comments` changing `lesson_id`/`user_id` | all blocked |
| 29 | — | the `used_count` reconciliation query (§5) after the whole matrix | matches |

Steps 21–21f need a test coupon code: the Owner creates the code `H2TEST` (`max_uses = 1`) in the dashboard; after checking, **turn it off** (`is_active = false`), do not delete it — a coupon that has orders referencing it cannot be deleted (`on delete restrict`, Codex r3).

Advisors after each migration: the only addition allowed is `security_definer_view` for `profile_cards`.

`npx tsc --noEmit`, `npm run lint` (separating pre-existing errors), `npm run build` for each checkpoint.

## 7. Risks

- **Missed profile/lesson reads** → after Migration B "Ẩn danh" or a 42501 error appears. Reduced by the grep in CP2 and by rerunning #13, #14, #17 on production right after applying B; roll back B if it breaks (A and the code stay, compatible).
- **View embed cannot be inferred** → the 2-query option (CP1).
- **Empty `identities`** depends on the "Confirm email" setting being on; if it is off, Supabase returns the error `user_already_exists` → handle both.
- **A redirect in a server component** when signed out must not block crawlers of the public course page — applied only at `/learn/*`.
- **Stale orders holding uses** (H2-2, D1) — an abandoned pending order holds the coupon use until it is cancelled/rejected. An admin handles stale orders at `/admin/transactions`. Automatic expiry of pending orders → later (record in problems).
- **`used_count` skew** if another path changes `payments.status` outside the 2 functions above. After H2-2 only `approvePayment` remains (it does not touch coupons) — grep `status:` in `app/action/` to confirm.

## Appendix A — old definitions (for writing the rollback)

```sql
create policy "Public profiles are viewable by everyone" on public.profiles for select to public using (true);
create policy "Public can view active coupons" on public.coupons for select to public using (true);
create policy "Public view exercises" on public.exercises for select to public using (true);
create policy "Only enrolled students can review" on public.reviews for insert to public
  with check (exists (select 1 from enrollments where enrollments.user_id = auth.uid() and enrollments.course_id = reviews.course_id));
-- comments UPDATE policy: with_check = null (qual: auth.uid() = user_id or admin exists).
-- lessons: rollback B = revoke select (cột) rồi grant select on public.lessons to anon, authenticated;
-- rollback A = drop view public.profile_cards; alter table public.lessons drop column has_video, drop column word_count;
--   (chỉ sau khi code không còn đọc 2 cột này).
```
