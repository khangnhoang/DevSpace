# Security hotfix — H2: chặn lộ dữ liệu và ghi giả danh

Trạng thái: Approved — Codex plan review PASS ở round 4 (2026-10-22, `gpt-6.1-sol`, high, read-only). Round 1–3 sửa: view `profile_cards` ghi xuyên RLS (default ACL), gate client chặn admin, `max_uses` null, chẩn đoán P4; duyệt đơn + enrollment trong một RPC trả jsonb; khoá coupon theo thứ tự id; `payments_guard` (INSERT + UPDATE OF) chặn code cũ trong khe chuyển phiên bản; preflight trong cùng transaction; rollback chặn reservation mới trước khi drain; FK `on delete restrict`.
Mức rủi ro: Cao (RLS, column grant, coupon/payment, DB hosted) → Codex review plan và diff.
Tách 2 PR, mỗi PR một nhánh, làm tuần tự:

| PR | Nhánh | Phạm vi |
|---|---|---|
| **H2-1** chặn lộ dữ liệu | `fix/h2-data-exposure` | P1 profiles PII, P2 coupon công khai, P13 nội dung bài học/quiz trả phí |
| **H2-2** toàn vẹn ghi | `fix/h2-write-integrity` (cắt từ `main` sau khi H2-1 merge) | P3 review giả danh, P4 comment đổi `user_id`, P5/P6 lượt dùng coupon, P25 duyệt đơn không nguyên tử |

**Quyết định Owner đã chốt (2026-10-22):**
- **D1** Lượt dùng coupon: **giữ chỗ khi áp mã**, trả lại khi huỷ / từ chối / đổi mã. `max_uses` là giới hạn cứng.
- **D2** Đăng nhập bằng email chưa đăng ký: **thông báo chung** "Email hoặc mật khẩu không đúng" (chống dò email).

Plan này nằm trên nhánh H2-1. H2-2 dùng lại plan (không viết plan mới) trừ khi H2-1 làm thay đổi thiết kế.

## 1. Bối cảnh (đã xác minh 2026-10-21)

Nguồn: code trên `main` @ `5c842d4` (sau H1) và metadata DB hosted `lkvxxrxojjlkchzzqidu` (`pg_policies`, `pg_constraint`, `information_schema.columns`). Không đọc dòng dữ liệu, trừ một đếm số bài học có `import`/`export` (0/80).

1. **P1 — `profiles` đọc công khai.** Policy `"Public profiles are viewable by everyone"` (SELECT, `public`, `true`). Anon đọc được `email, phone, dob, gender, province, role` của mọi người. Thêm nữa `app/(main)/login/page.tsx:46` `checkEmailExists` dùng chính lỗ này để báo "email chưa đăng ký / đã dùng" (dò email).
   Nơi cần dữ liệu công khai của người khác (chỉ `full_name, avatar_url`, và `role` cho badge admin):
   - review khoá: `app/(main)/course/[slug]/page.tsx:70` embed `profiles(full_name, avatar_url)`
   - bình luận: `lib/supabase.ts:1010` embed `profiles(full_name, avatar_url, role)`
   - giảng viên: `lib/supabase.ts:571` (`getFullCourseDetail`) và `:266` (`getInstructors`) embed qua `instructors.user_id → profiles`
   Các chỗ khác chỉ đọc profile của chính mình (Header, HeaderAdmin, finish page, `getProfile`, `requireAdmin`) hoặc chạy bằng service role / trang admin (`is_admin()`).
2. **P2 — `coupons` đọc công khai.** Policy `"Public can view active coupons"` (`true`). `CoursePaymentModal.tsx:51-69` đọc thẳng bảng coupons ở client, rồi tự tính giá lần hai sau khi `updatePaymentWithCoupon` đã tính trên server.
3. **P13 — nội dung trả phí đọc được không cần enroll.**
   - `lessons` và `exercises` có policy SELECT `true` cho `public`. Anon lấy được `lessons.content`, `video_url`, và toàn bộ câu hỏi + `correct_answer` qua REST.
   - `app/(main)/learn/[course]/[slug]/page.tsx` là server component dùng `supabase` của `lib/supabase.ts` (browser client → trên server là anon), `select("*")` theo slug, render MDX trên server rồi mới để `LearnClient` kiểm tra enroll ở client. Nội dung nằm sẵn trong RSC payload (đã thấy khi kiểm tra next-mdx-remote v6: `h1/h3/p/ul` trong HTML khi chưa đăng nhập).
   - Trang quiz `.../quiz/page.tsx` tương tự: lấy exercises kèm `correct_answer` không cần đăng nhập.
   - Trang lấy lesson theo `slug` toàn cục, không kiểm `lesson.course_id` khớp `[course]` trên URL.
   - Metadata bài học (`id, title, slug, course_id, chapter_id, order_index, created_at`) cần công khai: mục lục khoá, sidebar, dashboard profile, tính bài tiếp theo.
   - Hai chỗ đọc `video_url`/`content` chỉ để hiển thị metadata, cho mọi khách: `getLessonsByCourse` (`lib/supabase.ts:53`, sidebar: `video_url`) và `getFullCourseDetail` (`lib/supabase.ts:605`, trang khoá công khai: `video_url, content` để ước lượng thời lượng bằng `estimateTime` và gắn nhãn video/đọc). Trang khoá là client component → **mọi khách đang tải toàn bộ nội dung mọi bài** của khoá.
4. **P3 — review giả danh.** INSERT `reviews` chỉ kiểm enroll của `auth.uid()`, không ràng buộc `user_id = auth.uid()` → user đã enroll ghi review mang `user_id` người khác. Có `UNIQUE (user_id, course_id)` → còn chặn được người thật review sau. Client dùng `upsert` (`course/[slug]/page.tsx:161`).
5. **P4 — comment chuyển bài / đổi chủ.** UPDATE `comments` `qual = auth.uid() = user_id OR admin`, `with_check = null`. Postgres dùng `USING` làm điều kiện dòng mới khi thiếu `WITH CHECK` (Codex r1) → user thường **không** đổi được `user_id` sang người khác; nhưng vẫn chuyển được comment sang `lesson_id` khác, và admin đổi được `user_id`. Mức thấp; vẫn sửa bằng `WITH CHECK` tường minh + trigger bất biến để không phụ thuộc hành vi ngầm.
   INSERT `comments` đã có `with_check auth.uid() = user_id` → không giả danh khi tạo.
6. **P5/P6 — lượt dùng coupon.** `increment_coupon_usage` không tồn tại. UI không bao giờ truyền coupon vào `createPendingPayment`; coupon chỉ áp qua `updatePaymentWithCoupon`, hàm này không đếm lượt → `used_count` không bao giờ tăng, `max_uses` vô nghĩa. `payments` không lưu coupon nào đã áp. `finalAmount` có thể lẻ (cột `integer`).
7. **Metadata khác đã đọc (Codex r1 yêu cầu):**
   - RLS bật trên mọi bảng `public`. Không có view nào trong `public`. Function: `handle_new_user`, `is_admin` (definer), `prevent_role_escalation`, `update_updated_at_column` (invoker).
   - `payments`: chỉ có policy SELECT của chính mình → client không INSERT/UPDATE/DELETE được (mọi ghi đi qua service role).
   - `coupons`: chỉ policy SELECT `true` → client không ghi được.
   - `enrollments`: INSERT chỉ khoá `price = 0` và `user_id = auth.uid()`; SELECT của mình; `UNIQUE (user_id, course_id)`.
   - **Default ACL của `public`** (`pg_default_acl`): bảng/view mới tự cấp `arwdDxtm` cho `anon`, `authenticated`; function mới tự cấp `EXECUTE` cho `anon`, `authenticated`. → Mọi view/function mới phải `revoke` tường minh.
   - Coupon hiện có: 3 mã, không mã nào `max_uses` null. Đơn `pending` hiện có: 0.
8. **P25 (mới) — duyệt/từ chối đơn không nguyên tử.** `approvePayment` (`payment.ts:213`) và `rejectPayment` (`:312`) UPDATE chỉ theo `id`, không `status = 'pending'` → duyệt lại đơn đã huỷ/đã duyệt, gửi email lần nữa. Chỉ admin gọi được (sau H1) nên mức thấp, nhưng H2-2 cần nó nguyên tử để đếm coupon đúng một lần.

## 2. Mục tiêu và tiêu chí hoàn thành

### H2-1
- **B1** Anon và user thường không đọc được `email, phone, dob, gender, province` của người khác qua REST (`/rest/v1/profiles`). User vẫn đọc/sửa đủ profile của mình; admin vẫn đọc mọi profile.
- **B2** Tên/avatar/badge admin vẫn hiện đúng ở review, bình luận, giảng viên.
- **B3** Anon/user không liệt kê được coupon qua REST. Áp mã hợp lệ vẫn đổi giá; mã sai/hết lượt báo lỗi tiếng Việt.
- **B4** Anon và user chưa enroll không lấy được `lessons.content`, `lessons.video_url` qua REST, và trang `/learn/...` không gửi nội dung bài trong HTML/RSC payload cho họ.
- **B5** Anon và user chưa enroll không đọc được `exercises` (câu hỏi lẫn đáp án) qua REST hay trang quiz.
- **B6** User đã enroll (khoá free hoặc đã duyệt) và admin học/làm quiz bình thường; mục lục khoá, sidebar, dashboard tiến độ vẫn đúng.
- **B7** Trang admin bài học vẫn xem/sửa được `content`.
- **B8** Đăng ký với email đã có vẫn báo "Email này đã được sử dụng"; không còn truy vấn `profiles` theo email từ client.
- **B9** Không có thời điểm nào giữa deploy code và apply migration mà production vỡ (xem §5).

### H2-2
- **B10** Không tạo/sửa được review với `user_id ≠ auth.uid()`.
- **B11** Chủ comment không đổi được `user_id` (và `lesson_id`) của comment; admin vẫn soft-delete được.
- **B12** (D1) Áp mã thành công giữ 1 lượt (`used_count` +1) và lưu `payments.coupon_id`; áp lại cùng mã không tốn thêm lượt; đổi sang mã khác trả lượt mã cũ; huỷ hoặc từ chối đơn trả lượt; duyệt không đổi `used_count`. Duyệt/từ chối lại đơn đã xử lý bị chặn.
- **B13** Coupon hết lượt (`used_count >= max_uses`) bị từ chối khi áp, kể cả khi hai người áp cùng lúc lượt cuối (chỉ một người được).

## 3. Ngoài phạm vi

- Quiz chấm ở client và nhận `correct_answer` (user đã enroll xem được đáp án) → **P26**, làm cùng P20 (lưu kết quả quiz, chấm trên server).
- Comment: nội dung comment đã soft-delete vẫn đọc được qua REST; user chưa enroll vẫn đọc/ghi comment bài trả phí → **P27**.
- `profiles` UPDATE: user tự sửa được cột `email` trong profiles (không ảnh hưởng đăng nhập; email hệ thống gửi theo `profiles.email`) → **P28**.
- Kiểm tra "học theo thứ tự" (`isAllowed` trong `LearnClient`) vẫn ở client — đây là UX, không phải phân quyền.
- P7 nói chung (mọi server component đọc bằng anon) — H2-1 chỉ sửa trang learn/quiz/layout.

## 4. Thiết kế

### 4.1 H2-1 — DB, tách 2 migration để deploy an toàn

**Migration A (bổ sung, không phá gì)** `supabase/migrations/<ts>_h2_1a_public_profile_view.sql`:

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

- **Kiểm ngay sau khi apply A** (Codex r1 blocker): `POST`, `PATCH`, `DELETE /rest/v1/profile_cards` bằng anon và user thường đều bị từ chối (42501); `information_schema.table_privileges` của view chỉ còn `SELECT` cho 2 role.

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

- `word_count` khớp `estimateTime` hiện tại (bỏ thẻ HTML, tách theo khoảng trắng). `estimateTime` đổi chữ ký thành `(wordCount: number | null, hasVideo: boolean)`; `null` → 60 giây như cũ.
- Thêm cột stored viết lại bảng (80 dòng) — không đáng kể. Grant hiện tại ở cấp bảng nên anon/authenticated đọc được 2 cột mới ngay.
- Advisor sẽ báo `security_definer_view` (0010) — chấp nhận có chủ đích, ghi chú trong migration. Phương án thay thế (bảng đồng bộ bằng trigger) phức tạp hơn không cần thiết.
- PostgREST suy quan hệ của view theo FK của bảng gốc (`reviews.user_id → profiles.id`, `comments.user_id → profiles.id`, `instructors.user_id → profiles.id`) → embed được `profile_cards(...)`. **Phải kiểm ngay sau khi apply A** bằng 3 request REST (§6). Nếu embed không suy ra được: đổi sang 2 truy vấn (lấy danh sách `user_id` rồi `in()` vào view), ghi lại trong plan.

**Migration B (thu hẹp quyền)** `supabase/migrations/<ts>_h2_1b_restrict_reads.sql` — chỉ apply sau khi code H2-1 đã lên production:

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

- **Không dùng `(select auth.uid())` ở policy `profiles` (Codex, xác nhận bởi Main):** sublink trong policy SELECT của `profiles` khiến Postgres báo `42P17 infinite recursion detected in policy for relation profiles` khi viết lại policy UPDATE/DELETE admin (hai policy này subquery chính `profiles`) → mọi UPDATE/DELETE profile hỏng, kể cả user sửa profile mình. Dùng `auth.uid()` trần. Policy `exercises` giữ sublink vì chỉ đọc `lessons`/`enrollments`.
- Grant hiện tại của `lessons` (đã đọc): `anon` và `authenticated` có quyền cấp bảng `SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE` (mặc định Supabase), không có grant theo cột riêng. `revoke select` chỉ gỡ SELECT. (`TRUNCATE`/`TRIGGER` cho client là mặc định Supabase, RLS vẫn chặn ghi — ngoài phạm vi.)
- `lessons` UPDATE/INSERT/DELETE giữ nguyên grant (admin sửa qua client vẫn chạy; UPDATE lọc theo `id` chỉ cần SELECT trên `id`).
- Policy phụ của exercises chạy với quyền người gọi: cần SELECT trên `lessons.id, lessons.course_id` (có) và RLS `enrollments` (chỉ dòng của mình — đủ).
- Rollback: `supabase/rollbacks/<ts>_h2_1b_restrict_reads.down.sql` khôi phục đúng 3 policy cũ + grant cũ (định nghĩa cũ ở Phụ lục A). Rollback của A: `drop view public.profile_cards`.

### 4.2 H2-1 — code

**Client service role dùng chung.** Thêm `lib/supabase.admin.ts` (`import "server-only"`, export `supabaseAdmin`). Chỉ dùng trong file mới/sửa của H2; không bắt buộc thay các `createClient` có sẵn trong `app/action/*` (để PR gọn).

**Trang học `app/(main)/learn/[course]/[slug]/page.tsx`** — gate trên server trước khi đọc nội dung:
1. `getCurrentUser()`; không có → `redirect("/login")`.
2. Đọc lesson metadata theo `slug` + course theo `[course]` bằng `createSupabaseServerClient()` (cột công khai). Không có, hoặc `lesson.course_id ≠ course.id` → `<NotFoundLesson />`.
3. Quyền: enrollment của user cho `course.id` (server client, RLS chỉ trả dòng của mình) **hoặc** admin (đọc `profiles.role` của mình). Không có → `redirect(\`/course/${course}\`)`.
4. Chỉ sau bước 3 mới đọc `content, video_url` bằng `supabaseAdmin` theo `lesson.id`.
5. `LearnClient` (Codex r1): **xoá** phần kiểm đăng nhập/enroll ở client (`LearnClient.tsx:61-80`) — nó đẩy admin chưa enroll về `/`, trái B6. Server truyền prop `isAdmin`; phần kiểm "học theo thứ tự" giữ cho học viên và bỏ qua khi `isAdmin`. Trang quiz không có kiểm client tương tự → chỉ cần gate server.
Đóng gói bước 1–3 thành helper server-only `requireCourseAccess(courseSlug)` trong `lib/auth.server.ts` trả `{ user, course } | { redirect: string }`, dùng chung cho trang học và quiz.

**Trang quiz `.../quiz/page.tsx`** — dùng cùng helper; exercises đọc bằng server client (RLS mới cho phép vì đã enroll / admin). Không đổi cách chấm (P26).

**Metadata thay cho cột riêng tư:**
- `getLessonsByCourse`: `video_url` → `has_video`; type `lessonBasic` và nơi dùng (`LearnClient`, sidebar) đổi theo. `videoId` của bài đang học vẫn lấy từ bước 4 ở trên.
- `getFullCourseDetail`: bỏ `video_url, content`, dùng `has_video, word_count` cho `type` và `estimateTime`; bỏ trường `video_url` khỏi object trả về (và khỏi type nếu không ai đọc).

**`getLessonsByCourse` (`lib/supabase.ts:39`)** — nhận tham số `client` tuỳ chọn (mặc định `supabase` hiện tại). Layout `learn/[course]/layout.tsx`, trang học, trang quiz truyền server client để `exercises(count)` (cờ `has_exercise`) đúng với user đã enroll. Ở trang công khai (chưa enroll) `has_exercise` sẽ là `false` sau Migration B — chấp nhận.

**Không còn đọc `lessons.*`/`content`/`video_url` bằng anon/authenticated.** Grep toàn bộ `from("lessons")` và embed `lessons(` / `lessons (`:
- `getLessons()` (`lib/supabase.ts:377`, trang admin bài học, đọc `content`) → chuyển thành server action `getLessonsForAdmin()` trong `app/action/` với `requireAdmin()` + service role; `app/admin/lessons/page.tsx` gọi action này.
- Mọi `select("*")` trên lessons hoặc embed `lessons(*)` từ client → liệt kê cột cụ thể.
- Nơi khác đọc `content` (ví dụ tạo quiz AI) phải chạy trên server bằng service role sau `requireAdmin()` — kiểm khi grep.

**Profile công khai** — đổi 4 embed sang `profile_cards(...)`, giữ tên trường mà UI đọc bằng alias để không phải sửa component: `profiles:profile_cards(full_name, avatar_url)` (review), `profiles:profile_cards(full_name, avatar_url, role)` (comment), `profiles:profile_cards(full_name, avatar_url)` (`getFullCourseDetail`), `profiles:profile_cards(full_name)` (`getInstructors`). Grep lại `profiles(` / `profiles (` để không sót.

**Đăng ký / đăng nhập (`login/page.tsx`)** — xoá `checkEmailExists`:
- Đăng ký: sau `supabase.auth.signUp`, nếu `data.user && data.user.identities?.length === 0` → "Email này đã được sử dụng. Vui lòng chọn email khác hoặc đăng nhập." (hành vi của Supabase khi email đã tồn tại và bật xác nhận email). Bước kiểm ở `registerStep` 1 bỏ đi; thông báo chuyển về sau bước gửi form.
- Đăng nhập (D2): bỏ thông báo "Email này chưa được đăng ký"; lỗi đăng nhập dùng thông báo chung "Email hoặc mật khẩu không đúng".

**Coupon (`CoursePaymentModal.tsx`)** — xoá truy vấn `coupons` và phần tự tính giá ở client. `updatePaymentWithCoupon` trả thêm `discountPercent` và phân biệt lỗi tiếng Việt: "Mã giảm giá không tồn tại hoặc đã hết hạn" / "Mã này đã hết lượt sử dụng". Kiểm hết lượt chỉ khi `max_uses !== null` (null = không giới hạn; JS so `n >= null` thành `n >= 0` → từ chối nhầm). Modal chỉ hiển thị theo kết quả server. `finalAmount` làm tròn `Math.round`.

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

- `approve_payment` (Codex r1): trạng thái và enrollment cùng commit hoặc cùng rollback — không còn trường hợp đơn `success` mà chưa có quyền học. Duyệt song song với huỷ/từ chối: cả hai đều UPDATE có điều kiện `status = 'pending'` trên cùng dòng → Postgres tuần tự hoá, chỉ một bên thắng.
- **Đơn cũ đã giảm giá (Codex r1, r2):** khối `do $$` cuối migration đếm đơn pending có `amount < price` (giảm giá theo luồng cũ, không có `coupon_id`) **trong cùng transaction với việc tạo `payments_guard`** → không có khe giữa lúc kiểm và lúc chặn. Hiện là 0. Nếu > 0 migration tự huỷ; Main báo Owner chọn từ chối từng đơn hoặc cho phép ngoại lệ.
- **`payments_guard` (Codex r2, r3):** ngoài 3 RPC, (a) INSERT chỉ được tạo đơn `pending`, đúng giá khoá, `coupon_id` null — chặn `createPendingPayment(courseId, couponCode)` cũ (vẫn gọi thẳng được dù UI không truyền); (b) mọi UPDATE có `amount`/`status`/`coupon_id` trong danh sách SET bị chặn, kể cả gán lại cùng giá trị — chặn action duyệt cũ duyệt lại đơn đã `success` rồi gửi email. Trigger chạy cả với service role. GUC `app.payment_rpc` chỉ đặt được trong session DB: client REST không có đường đặt nó (PostgREST không cho đặt GUC tuỳ ý; `set_config` không được expose vì `public` không có wrapper nào), service role thì đã là quyền cao nhất. Hệ quả: từ lúc apply migration tới lúc code mới lên, thao tác thanh toán của code cũ (áp mã, huỷ, duyệt, từ chối) **báo lỗi thay vì làm lệch `used_count`** — chấp nhận vài phút gián đoạn. `updated_at` và các cột khác vẫn sửa được.

- **D1 — giữ chỗ khi áp.** `FOR UPDATE` trên payment chặn hai lần áp song song trên cùng đơn; UPDATE có điều kiện `used_count < max_uses` chặn hai đơn tranh lượt cuối (Postgres khoá dòng coupon, lần thứ hai đánh giá lại điều kiện sau khi lần đầu commit).
- Duyệt đơn **không** đổi `used_count` (lượt đã giữ từ lúc áp) — chỉ cần UPDATE nguyên tử `status = 'pending' → 'success'` (§4.4).
- Đơn pending bỏ dở giữ lượt cho tới khi bị huỷ/từ chối — chấp nhận (admin từ chối đơn treo để trả lượt). Đơn pending cũ có sẵn trước migration có `coupon_id = null` → không trả lượt nào, đúng vì trước đây chưa từng đếm.
- `max_uses` hiện là `integer` có thể null → coi null là không giới hạn.
- Hai hàm chỉ service role gọi (revoke khỏi client); server action vẫn `requireUser`/`requireAdmin` trước khi gọi và truyền `user.id` từ session, không từ client. Trigger `prevent_comment_reassign` là INVOKER và chặn cả service role — chấp nhận (không có luồng hợp lệ nào đổi chủ comment).

### 4.4 H2-2 — code

- `updatePaymentWithCoupon`: `requireUser()` rồi `rpc("apply_payment_coupon", { p_payment_id, p_user_id: user.id, p_code })`; map lỗi: `invalid_payment` → "Đơn hàng không hợp lệ", `invalid_coupon` → "Mã giảm giá không tồn tại hoặc đã hết hạn", `coupon_exhausted` → "Mã này đã hết lượt sử dụng". Trả `{ newAmount, discountPercent }` (H2-1 đã đổi modal sang dùng 2 trường này).
- `createPendingPayment`: bỏ tham số `couponCode` và nhánh gọi `increment_coupon_usage` (không caller nào truyền).
- `cancelPayment`: `rpc("close_pending_payment", { p_payment_id, p_user_id: user.id })`; `false` → "Không thể hủy giao dịch này".
- `rejectPayment` (`payment.ts:312`, hiện UPDATE chỉ theo `id`): `requireAdmin()` rồi `rpc("close_pending_payment", { p_payment_id, p_user_id: null })`; `false` → "Đơn đã được xử lý".
- `approvePayment`: `requireAdmin()` rồi `rpc("approve_payment", { p_payment_id })`; `data?.approved !== true` → "Đơn đã được xử lý", không gửi email. Email + thông báo chỉ gửi khi `approved === true` (đã commit), dùng `user_id`/`course_id` trong kết quả. Xoá đoạn enroll riêng hiện tại (`payment.ts:241-254`).
- Review/comment: không đổi code (client đã gửi đúng `user_id` của mình).

## 5. Thứ tự triển khai và checkpoint

**H2-1** (Sonnet trên `fix/h2-data-exposure`, Main apply migration sau khi Owner duyệt):
1. **CP1** — viết Migration A + rollback; đổi 4 embed sang `profile_cards`. Main apply A, kiểm embed bằng REST (§6). Nếu embed hỏng → phương án 2 truy vấn trước khi đi tiếp.
2. **CP2** — `lib/supabase.admin.ts`, `requireCourseAccess`, trang học, trang quiz, layout, `getLessonsByCourse(client)`, `getLessonsForAdmin`, bỏ mọi đọc `content`/`*` lessons từ client.
3. **CP3** — đăng ký/đăng nhập bỏ `checkEmailExists`; coupon modal + `updatePaymentWithCoupon`.
4. **CP4** — viết Migration B + rollback (không apply). Main review diff, Codex review diff.
5. Merge + deploy code H2-1 (chạy được với DB cũ vì A đã có, B chưa). Kiểm production cơ bản.
6. Main apply B (Owner duyệt), chạy lại ma trận §6 trên production/localhost.

**H2-2** (nhánh mới từ `main` sau bước 6): migration + code cùng PR.
1. Owner chọn lúc ít người mua (vài phút thao tác thanh toán sẽ báo lỗi).
2. Apply migration. Preflight trong migration tự huỷ nếu có đơn cũ đã giảm giá. Từ đây `payments_guard` chặn mọi đường ghi thanh toán của code cũ (kể cả INSERT giảm giá) → không reservation nào bị phá, không có đơn giảm giá mới thiếu `coupon_id` (Codex r2).
3. Merge + deploy code H2-2. Request cũ còn chạy (kể cả qua Skew Protection nếu bật) chỉ nhận lỗi, không ghi sai.
4. Chạy ma trận §6 H2-2 và query đối soát (dưới).

**Rollback H2-2** (Codex r1, r2) — rollback là quay về hành vi trước H2-2, nơi `max_uses` **không** được thực thi; D1 không giữ được sau rollback, Owner chấp nhận khi quyết định rollback.
0. Chặn reservation mới ở DB trước (Codex r3): `revoke execute on function public.apply_payment_coupon(bigint, uuid, text) from service_role;` — lần gọi mới bị từ chối, lần gọi đang chạy tự kết thúc (kiểm `pg_stat_activity` không còn query `apply_payment_coupon`). `approve_payment` và `close_pending_payment` vẫn chạy để xử lý đơn.
1. Khi code H2-2 còn chạy: admin xử lý hết đơn pending có `coupon_id` (duyệt hoặc từ chối qua RPC) để không còn reservation treo; kiểm `select count(*) from payments where status = 'pending' and coupon_id is not null` = 0.
2. Revert code về H2-1. Guard vẫn còn → code cũ chạm thanh toán sẽ báo lỗi, không ghi sai.
3. Ngay sau đó apply `supabase/rollbacks/<ts>_h2_2_write_integrity.down.sql`: drop `payments_guard` và 3 RPC; giữ cột `coupon_id` (lịch sử, code cũ bỏ qua); khôi phục policy reviews/comments cũ nếu lý do rollback nằm ở đó.
4. Đối soát chỉ chạy khi writer đã dừng (giữa bước 2 và 3, guard đang chặn), để ghi lại số liệu chứ không duy trì D1:
   ```sql
   select c.code, c.used_count,
          (select count(*) from public.payments p
            where p.coupon_id = c.id and p.status in ('pending', 'success')) as reserved
   from public.coupons c;
   ```
   Khi H2-2 đang chạy, `used_count = reserved` là bất biến — query này cũng dùng cho #29.

## 6. Kiểm chứng

Công cụ: curl tới REST với anon key và access token của user test (Owner đăng nhập trong browser pane; Main lấy token từ cookie của phiên đó), như H1. SQL chỉ đọc, trừ khi Owner duyệt.

**Sau Migration A:** REST `reviews?select=id,profiles:profile_cards(full_name)`, `comments?select=id,profiles:profile_cards(full_name,role)`, `courses?select=id,instructors(profiles:profile_cards(full_name))` trả tên.

**Ma trận H2-1 (sau B):**

| # | Ai | Thao tác | Kỳ vọng |
|---|---|---|---|
| 1 | anon | `GET /profiles?select=email,phone` | `[]` |
| 2 | user A | `GET /profiles?select=email&id=neq.<A>` | `[]`; `id=eq.<A>` trả của A |
| 3 | admin | `GET /profiles?select=email` | mọi dòng |
| 4 | anon | `GET /profile_cards?select=*` | chỉ 4 cột công khai |
| 5 | anon, user A | `GET /coupons` | `[]` |
| 6 | anon | `GET /lessons?select=content` | lỗi 42501 (permission denied for column) |
| 7 | anon | `GET /lessons?select=id,title,slug,has_video,word_count` | trả dữ liệu |
| 7b | anon | mở `/course/<X>` | thời lượng, nhãn video/đọc như trước; network không có `content`/`video_url` |
| 8 | user A chưa enroll khoá X | `GET /exercises?lesson_id=eq.<bài của X>` | `[]` |
| 9 | user A đã enroll khoá X | như #8 | có câu hỏi |
| 10 | anon | `curl /learn/<X>/<bài>` | 307 → `/login`, HTML không chứa nội dung bài |
| 11 | user A chưa enroll | mở `/learn/<X>/<bài>` | về `/course/<X>`, payload không có nội dung |
| 12 | user A | `/learn/<khoá khác>/<bài của X>` (lệch course) | NotFound |
| 13 | user A đã enroll / admin | học bài, sidebar có cờ quiz, làm quiz | bình thường |
| 14 | admin | `/admin/lessons` xem/sửa nội dung | bình thường |
| 15 | — | đăng ký bằng email đã có | "Email này đã được sử dụng" |
| 16 | user A | áp coupon đúng / sai / hết lượt | đổi giá / 2 thông báo lỗi tiếng Việt |
| 17 | anon | review/comment/giảng viên trên trang khoá | hiện tên, avatar, badge admin |
| 17b | anon, user A | `POST`/`PATCH`/`DELETE /profile_cards` | 42501 (kiểm ngay sau A) |
| 17c | admin chưa enroll khoá X | mở bài + quiz của X | vào được, không bị đẩy về `/` |
| 17d | user A | coupon có `max_uses` null (tạo tạm) | áp được |
| 17e | anon | `POST /graphql/v1` query `lessonsCollection { edges { node { content } } }` và `profilesCollection { ... email }` | lỗi quyền / rỗng như REST |
| 17f | user A chưa enroll | xem RSC payload trang quiz (`curl` với cookie) | không có câu hỏi/đáp án |
| 17g | user A | sửa profile của mình (đường `updateUserProfile`) | thành công, không lỗi 42P17 |
| 17h | admin | sửa profile của user khác | thành công, không lỗi 42P17 |
| 17i | admin | xoá profile qua UI admin | chỉ thử trên tài khoản tạm; nếu bỏ qua thì ghi rõ; không được có 42P17 |

**Ma trận H2-2:**

| # | Ai | Thao tác | Kỳ vọng |
|---|---|---|---|
| 18 | user A đã enroll | `POST /reviews` với `user_id = B` | 42501 |
| 19 | user A | `PATCH /comments?id=eq.<của A>` đặt `user_id = B` | lỗi (RLS hoặc trigger) |
| 20 | admin | soft-delete comment của A | thành công |
| 21 | user A | áp mã M lên đơn pending | `used_count(M)` +1, `payments.coupon_id = M` |
| 21b | user A | áp lại M | `used_count(M)` không đổi |
| 21c | user A | đổi sang mã N | `N` +1, `M` −1 |
| 21d | user A | huỷ đơn / admin từ chối đơn | mã đang áp −1, đơn `failed` |
| 21e | admin | duyệt đơn có mã | `used_count` không đổi, đơn `success` |
| 21f | 2 user | áp cùng lúc mã còn 1 lượt (2 request song song) | đúng 1 thành công, `used_count = max_uses` |
| 22 | admin | duyệt/từ chối lại đơn đã xử lý | "Đơn đã được xử lý", `used_count` không đổi, không gửi email |
| 23 | anon, user | `POST /rpc/apply_payment_coupon`, `/rpc/close_pending_payment`, `/rpc/approve_payment`, `/rpc/payments_guard` | 42501 / 404 |
| 23b | admin | `approve_payment` với id không tồn tại / đơn đã xử lý — xem body REST thật | `{"approved": false}`, không email |
| 23c | service role | `PATCH /payments` đặt `status`/`amount` trực tiếp, kể cả gán lại `status = 'success'` cho đơn đã duyệt (giả code cũ) | 42501 từ `payments_guard`; chỉ `updated_at` thì được |
| 23d | service role | `POST /payments` với `amount < price` hoặc có `coupon_id` (giả `createPendingPayment` cũ có coupon) | 42501; `POST` đơn pending đúng giá vẫn được |
| 23e | service role | `DELETE /coupons?id=eq.<H2TEST>` khi đã có đơn tham chiếu | lỗi FK 23503, không đụng guard |
| 23f | — | rollback bước 0: revoke `apply_payment_coupon` khỏi service_role rồi gọi action áp mã | lỗi, không tạo reservation; huỷ/duyệt vẫn chạy (kiểm trên Supabase branch hoặc bỏ qua nếu không rollback thật) |
| 24 | user A | `updatePaymentWithCoupon` lên đơn của B | "Đơn hàng không hợp lệ" |
| 25 | 2 user | đổi mã ngược chiều cùng lúc (đơn 1: M→N, đơn 2: N→M) | cả hai xong, không deadlock, tổng `used_count` đúng |
| 26 | admin | duyệt đơn → enrollment có ngay; duyệt đơn của user đã enroll sẵn | thành công, không lỗi trùng |
| 27 | admin + user | duyệt và huỷ cùng một đơn cùng lúc | đúng một bên thắng; nếu duyệt thắng thì có enrollment |
| 28 | user A | REST trực tiếp: `PATCH /payments` (amount/status/coupon_id), `PATCH /coupons` (used_count), `POST /enrollments` khoá trả phí, `PATCH /comments` đổi `lesson_id`/`user_id` | đều bị chặn |
| 29 | — | query đối soát `used_count` (§5) sau toàn bộ ma trận | khớp |

Các bước 21–21f cần mã coupon test: Owner tạo mã `H2TEST` (`max_uses = 1`) trên dashboard; sau khi kiểm thì **tắt** (`is_active = false`), không xoá — coupon đã có đơn tham chiếu không xoá được (`on delete restrict`, Codex r3).

Advisors sau mỗi migration: chỉ được thêm `security_definer_view` cho `profile_cards`.

`npx tsc --noEmit`, `npm run lint` (tách lỗi có sẵn), `npm run build` cho mỗi checkpoint.

## 7. Rủi ro

- **Sót chỗ đọc profile/lesson** → sau Migration B hiện "Ẩn danh" hoặc lỗi 42501. Giảm bằng grep trong CP2 và chạy lại #13, #14, #17 trên production ngay sau khi apply B; rollback B nếu vỡ (A và code giữ nguyên, tương thích).
- **Embed view không suy được** → phương án 2 truy vấn (CP1).
- **`identities` rỗng** phụ thuộc cấu hình "Confirm email" đang bật; nếu tắt, Supabase trả lỗi `user_already_exists` → xử lý cả hai.
- **Redirect trong server component** khi chưa đăng nhập phải không chặn crawler trang khoá công khai — chỉ áp ở `/learn/*`.
- **Đơn treo giữ lượt** (H2-2, D1) — đơn pending bỏ dở giữ lượt coupon tới khi bị huỷ/từ chối. Admin xử lý đơn treo ở `/admin/transactions`. Tự động hết hạn đơn pending → sau (ghi problems).
- **Sai lệch `used_count`** nếu có đường khác đổi `payments.status` ngoài 2 hàm trên. Sau H2-2 chỉ còn `approvePayment` (không đụng coupon) — grep `status:` trong `app/action/` để xác nhận.

## Phụ lục A — định nghĩa cũ (để viết rollback)

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
