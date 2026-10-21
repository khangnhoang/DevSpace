# Security hotfix — H1: chặn leo quyền và guard server action

Trạng thái: Approved — Codex plan review PASS ở round 4 (2026-10-21, `gpt-6.1-sol`, high, read-only). Round 1–3 sửa: mật khẩu cố định, PKCE bắt buộc, allowlist `next`, UPDATE payment nguyên tử, ma trận kiểm chứng, callback đổi code trên server.
Nhánh: `fix/auth-server-guard`
Mức rủi ro: Cao (auth, phân quyền admin, payment, DB hosted) → Codex review cả plan lẫn diff.
Phần tiếp theo: H2 (xem [problems.md](problems.md)) — không làm trong H1.

## 1. Bối cảnh (đã xác minh 2026-10-21)

Nguồn: đọc code trên `main` @ `3d565dd` và đọc metadata DB hosted `lkvxxrxojjlkchzzqidu` (pg_policies, pg_proc, pg_trigger, column grants, security advisors). Không đọc dòng dữ liệu.

1. **Session chỉ nằm ở localStorage.** `lib/supabase.ts` dùng `createClient` của `@supabase/supabase-js`; không có `middleware.ts`/`proxy.ts`. Server (server component, server action) không bao giờ biết người gọi là ai.
2. **Server action dùng service role và không kiểm tra người gọi.** Mọi export trong `app/action/*.ts` là endpoint POST công khai. Ví dụ: `approvePayment`, `rejectPayment`, `getAllPayments`, `createNewUser`, `deleteUserAccount`, các hàm `admin-dashboard.ts`, `generateQuizFromContent` (tốn tiền API).
3. **`enrollCourse(courseId, userId, price)`** tin `userId` và `price` từ client → enroll khoá trả phí miễn phí bằng cách gửi đúng giá, hoặc enroll hộ người khác.
4. **`sendSuccessEmail`** được export từ file `"use server"` → ai cũng gửi được email tới địa chỉ tuỳ ý qua Gmail của hệ thống.
5. **Leo quyền ở DB:**
   - `handle_new_user()` (trigger `on_auth_user_created`) ghi `role = COALESCE(raw_user_meta_data->>'role', 'user')`. Bất kỳ ai gọi `auth.signUp({ options: { data: { role: 'admin' } } })` bằng anon key đều thành admin.
   - Policy `"Users can update own profile or Admin"` trên `profiles` (UPDATE, `qual = auth.uid() = id OR is_admin()`, `with_check = null`) + column grant UPDATE trên `profiles.role` cho `authenticated` → user tự đổi `role` của mình thành `admin`.
   - `handle_new_user`, `is_admin` là `SECURITY DEFINER`, không set `search_path`, và `anon`/`authenticated` gọi được qua `/rest/v1/rpc/*`.
6. **Admin chỉ được chặn ở client** (`app/admin/layout.tsx` kiểm tra role trong `useEffect`).
7. Dead code: `confirmPaymentAndEnroll` (payment.ts) và `app/components/CoursePayment.tsx` không còn được import, nhưng `confirmPaymentAndEnroll` vẫn là action đặt `payments.status = 'success'` không cần thanh toán.
8. **Mật khẩu cố định**: `app/admin/users/page.tsx:128` luôn gửi `password: "123123"` khi tạo user; `app/action/user.ts` cũng mặc định `'123123'`. Kết hợp email và role đọc công khai trong `profiles` → đăng nhập được mọi admin tạo qua UI.
9. **Open redirect / XSS ở callback**: `app/auth/callback/page.tsx` đưa thẳng `searchParams.get("next")` vào `router.replace` (cả nhánh timeout không cần đăng nhập) → `?next=javascript:...` hoặc URL ngoài origin.
10. **Cập nhật payment không nguyên tử**: `updatePaymentWithCoupon` và `cancelPayment` chỉ lọc theo `id` khi UPDATE.

RLS của các bảng nội dung (courses, chapters, lessons, exercises) đã chặn ghi cho non-admin, nên các thao tác ghi của admin từ trình duyệt trong `lib/supabase.ts` an toàn **khi và chỉ khi** không ai tự lên được admin — vì vậy mục 5 là trọng tâm.

## 2. Mục tiêu và tiêu chí hoàn thành

Phải đúng sau H1:

- A1. Đăng ký kèm `role: 'admin'` trong metadata → profile mới có `role = 'user'`.
- A2. User thường (không phải admin) update `profiles.role` của chính mình (hoặc insert profile với role admin) → bị DB từ chối.
- A3. Admin đổi role người khác từ trang `/admin/users` vẫn hoạt động. `createNewUser` do admin gọi với `role: 'admin'` vẫn tạo ra admin.
- A4. Mọi server action admin-only trả lỗi (không chạy query service role) khi người gọi chưa đăng nhập hoặc không phải admin.
- A5. Server action phía học viên lấy user từ session, không từ tham số; chỉ thao tác trên payment của chính user đó.
- A6. `enrollCourse` chỉ enroll khoá `price = 0`; khoá trả phí chỉ được enroll qua `approvePayment` (admin).
- A7. `sendSuccessEmail` không còn là server action gọi được từ client.
- A8. Truy cập `/admin/*` khi chưa đăng nhập → redirect `/login`; đăng nhập nhưng không phải admin → redirect `/`. Kiểm tra chạy trên server, trước khi render.
- A9. Đăng nhập, đăng xuất, đăng ký, quên mật khẩu → đặt lại mật khẩu, xem khoá, học bài, quiz, ghi chú, bình luận, thanh toán → admin duyệt, CRUD admin: hành vi như trước. Ngoại lệ đã biết: (a) user đang đăng nhập phải đăng nhập lại một lần vì session chuyển từ localStorage sang cookie; (b) auth chuyển sang PKCE (4.2) nên link email đã gửi trước khi deploy không dùng được, và link mới phải mở trên cùng trình duyệt đã yêu cầu.
- A10. `npm run lint` không thêm lỗi mới so với baseline; `npx tsc --noEmit` và `npm run build` pass.
- A11. Không còn mật khẩu cố định: tạo user từ admin bắt buộc admin nhập mật khẩu ≥ 8 ký tự; action từ chối nếu thiếu hoặc ngắn hơn.
- A12. Callback chỉ điều hướng tới đích trong allowlist (`/`, `/auth/reset-password`); mọi giá trị `next` khác (URL tuyệt đối, `//host`, `javascript:`, path lạ) → `/`.
- A13. `updatePaymentWithCoupon` và `cancelPayment` chỉ đổi dòng thoả cùng lúc `id`, `user_id = user hiện tại`, `status = 'pending'` trong chính câu UPDATE; 0 dòng bị đổi → trả lỗi.

Phải giữ nguyên: schema bảng, dữ liệu, các policy RLS khác, giao diện (trừ ô mật khẩu mới ở form tạo user).

## 3. Ngoài phạm vi (ghi vào problems.md, làm ở H2 hoặc sau)

Nội dung bài học/quiz trả phí đọc được không cần enroll (P13 — Owner quyết định đưa vào H2, tách H2-1/H2-2 nếu lớn); PII của `profiles` đọc công khai; `coupons` đọc công khai và kiểm tra coupon ở client; policy `reviews` không ràng buộc `user_id`; `comments` UPDATE không có `with_check`; RPC `increment_coupon_usage` không tồn tại trên DB; coupon bị tính lượt khi mới tạo đơn pending; bật leaked password protection; GraphQL exposure; bucket `avatars` cho upload mọi path; chuyển link email sang `token_hash` + `verifyOtp` để mở được trên trình duyệt khác.

## 4. Thiết kế

### 4.1 DB — migration `supabase/migrations/20261021131351_h1_block_role_escalation.sql`

Repo chưa có thư mục `supabase/`. Tạo file migration này làm bản ghi lịch sử (chưa có baseline schema; baseline thuộc program test-infra). Sonnet chỉ viết file, **không apply**. Main apply lên hosted sau khi Owner duyệt (Supabase MCP `apply_migration`), rồi kiểm tra lại.

Nội dung yêu cầu:

1. `create or replace function public.handle_new_user()` — giữ nguyên các cột đang ghi, nhưng `role` luôn là `'user'` (bỏ đọc `raw_user_meta_data->>'role'`). Thêm `set search_path = ''` và đổi tham chiếu thành `public.profiles`.
2. `create or replace function public.is_admin()` — giữ logic, thêm `set search_path = ''`, tham chiếu `public.profiles`.
3. `alter function public.update_updated_at_column() set search_path = ''`.
4. Function trigger mới `public.prevent_role_escalation()` — **`security invoker`** (mặc định, không khai báo `security definer`), `set search_path = ''`:
   - `BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW` (không dùng `UPDATE OF role` để không phụ thuộc danh sách cột trong câu lệnh).
   - Vì là invoker, `current_user` là role thực sự đang chạy câu lệnh: `anon`/`authenticated` cho request PostgREST, `service_role` cho service key, `postgres` cho dashboard và cho phần thân của `handle_new_user` (function `security definer`, owner `postgres`).
   - Cho qua khi `current_user not in ('anon', 'authenticated')` hoặc `public.is_admin()` đúng (`is_admin` là `security definer` nên `authenticated` gọi được).
   - Ngược lại: INSERT với `NEW.role is distinct from 'user'` → `raise exception`; UPDATE với `NEW.role is distinct from OLD.role` → `raise exception`.
   - Comment SQL giải thích vì sao chọn `security invoker`.
5. `revoke execute on function public.handle_new_user() from public, anon, authenticated;` (chỉ trigger dùng).
6. Không revoke `is_admin()` vì policy RLS gọi nó với role `authenticated`.
7. Toàn bộ trong một transaction; idempotent khi chạy lại (`create or replace`, `drop trigger if exists`).

Kèm file rollback `supabase/rollbacks/20261021131351_h1_block_role_escalation.down.sql` khôi phục đúng định nghĩa cũ của `handle_new_user`/`is_admin` (lấy từ mục 1 ở trên — Main đã có bản `pg_get_functiondef`, xem Phụ lục A) và drop trigger/function mới.

### 4.2 Session qua cookie

- `lib/supabase.ts`: thay `createClient(...)` bằng `createBrowserClient(url, key)` từ `@supabase/ssr`, vẫn export tên `supabase` để không phải sửa ~30 chỗ import.
- **Auth chuyển sang PKCE.** `createBrowserClient` của `@supabase/ssr@0.7.0` ép `flowType: "pkce"` (`node_modules/@supabase/ssr/src/createBrowserClient.ts`, khối `auth`), không giữ implicit được. Hệ quả và xử lý:
  - Link email (xác nhận đăng ký, quên mật khẩu) giờ về `/auth/callback?code=...&next=...`.
  - **Đổi code trên server, không ở client.** Thay `app/auth/callback/page.tsx` (client) bằng route handler `app/auth/callback/route.ts` (GET) theo mẫu SSR chuẩn của Supabase: đọc `code`, gọi `exchangeCodeForSession(code)` bằng `createSupabaseServerClient()` (code verifier nằm trong cookie do `@supabase/ssr` ghi). Lý do: chỉ coi là thành công khi **chính request này** đổi code thành công, không chỉ "có session". Nếu kiểm tra phía client bằng `getSession()`, một trình duyệt đang đăng nhập user A mở link recovery của B mà thiếu verifier sẽ nhận lại session A, rồi trang reset đổi mật khẩu của A (Codex round 3). Trình duyệt không bao giờ tải một trang có `?code=` nên `detectSessionInUrl` của browser client không chạy song song.
  - Thành công → `NextResponse.redirect` tới `safeNextPath(next)` trên cùng origin, cookie session mới (của chủ link) ghi đè session cũ.
  - Thiếu `code`, có `error`/`error_description`, hoặc `exchangeCodeForSession` trả lỗi (link cũ dạng implicit, mở ở trình duyệt khác, code hết hạn, thiếu verifier) → redirect tới trang mới `app/auth/error/page.tsx` hiện thông báo lỗi rõ ràng và nút về `/login`. Không đụng tới session đang có.
  - `app/auth/reset-password/page.tsx` giữ nguyên.
  - Kiểm tra `emailRedirectTo`/`redirectTo` trong `app/(main)/login/page.tsx` vẫn trỏ về `/auth/callback`.
- **Allowlist `next` ở callback** (A12): hàm thuần `safeNextPath(raw: string | null): "/" | "/auth/reset-password"` trong `lib/safe-next-path.ts`, dùng cho cả nhánh thành công và nhánh timeout.
- File này đang được import cả trong server component (`app/(main)/learn/[course]/layout.tsx`, `[slug]/page.tsx`, `quiz/page.tsx`, `app/admin/courses/page.tsx`, `app/components/Sidebar.tsx`). Rủi ro phải chứng minh: `createBrowserClient` chạy trên server (không có `document`) vẫn query được dữ liệu public như trước. Nếu không, tách nhánh theo `typeof window` hoặc cho các file server đó dùng một client anon riêng — không đổi hành vi đọc của chúng trong H1.
- `proxy.ts` ở root + `lib/supabase.proxy.ts` (hàm `updateSession`): theo mẫu `C:\VocaSpace\proxy.ts` và `C:\VocaSpace\utils\supabase\middleware.ts` (chỉ phần refresh session bằng `getUser()` và chuyển người chưa đăng nhập vào `/admin/*` về `/login`; bỏ phần teacher/profile/sign-in-reason của VocaSpace). Không thêm `next`/redirect param (tránh open redirect).
- `lib/supabase.server.ts` giữ nguyên.

### 4.3 Guard phía server — `lib/auth.server.ts`

- `import "server-only"`.
- `getCurrentUser()`: `createSupabaseServerClient()` → `auth.getUser()`; trả `User | null`.
- `requireUser()`: ném/ trả lỗi chuẩn khi chưa đăng nhập.
- `requireAdmin()`: `requireUser()` rồi đọc `profiles.role` của user đó (bằng server client của chính user; RLS SELECT trên profiles đang public). Không tin `user_metadata`.
- Server action trả về object lỗi theo đúng kiểu mỗi action đang trả (ví dụ `{ error: "..." }`, `[]`, `null`) để UI không vỡ; helper nên trả kết quả dạng `{ user } | { error }` thay vì throw, để từng action map sang kiểu trả về hiện có.

### 4.4 Áp guard vào từng action

| File | Action | Thay đổi |
|---|---|---|
| `admin-dashboard.ts` | cả 4 hàm | `requireAdmin()` đầu hàm; không đạt → trả giá trị rỗng như nhánh lỗi hiện tại (`null` / `[]`) |
| `payment.ts` | `getAllPayments`, `approvePayment`, `rejectPayment` | `requireAdmin()` |
| `payment.ts` | `createPendingPayment(courseId, userId, coupon)` | bỏ tham số `userId`, lấy từ `requireUser()`; cập nhật caller ở `app/(main)/course/[slug]/page.tsx` |
| `payment.ts` | `updatePaymentWithCoupon`, `cancelPayment` | `requireUser()`; câu UPDATE lọc đồng thời `.eq("id", paymentId).eq("user_id", user.id).eq("status", "pending")` và `.select("id")`; kiểm tra `error` và số dòng trả về, 0 dòng → `{ error }` (A13). Bước đọc trước đó (lấy `course_id` để tính giá) cũng lọc theo `user_id` |
| `payment.ts` | `confirmPaymentAndEnroll` | xoá |
| `enroll.ts` | `enrollCourse(courseId, userId, price)` | đổi thành `enrollCourse(courseId)`; user từ `requireUser()`; chỉ `course.price === 0`, ngược lại trả lỗi; cập nhật caller |
| `user.ts` | `createNewUser`, `deleteUserAccount` | `requireAdmin()`. `createNewUser`: `password` bắt buộc, ≥ 8 ký tự, bỏ mặc định `'123123'`; `role` chỉ nhận `'user'` hoặc `'admin'`; sau `auth.admin.createUser`, nếu `role === 'admin'` thì update `profiles.role` bằng service role (vì trigger mới luôn ghi `'user'`), lỗi bước này → xoá user vừa tạo và trả `{ error }` |
| `app/admin/users/page.tsx` | form tạo user | thêm ô mật khẩu (chỉ khi tạo mới, không khi sửa), bỏ `password: "123123"` |
| `gemini.ts` | `generateQuizFromContent` | `requireAdmin()` |
| `email.ts` | `sendSuccessEmail` | chuyển sang `lib/email.server.ts` (không `"use server"`, có `import "server-only"`), xoá `app/action/email.ts`; cập nhật import trong `payment.ts` |
| `get-notifications.ts` | `markAsRead` | giữ nguyên (đã dùng client của user + RLS; giờ hoạt động vì có cookie) |

Xoá `app/components/CoursePayment.tsx`. Xoá dependency `@supabase/auth-helpers-nextjs` nếu `grep` xác nhận không còn import.

### 4.5 Guard trang admin

- Đổi `app/admin/layout.tsx` hiện tại (client) thành `app/admin/AdminShell.tsx` giữ nguyên UI nhưng bỏ phần tự kiểm tra quyền.
- `app/admin/layout.tsx` mới là server component: `requireAdmin()`; chưa đăng nhập → `redirect('/login')`, không phải admin → `redirect('/')`; đạt → render `<AdminShell>`.

## 5. Checkpoint triển khai (Sonnet)

Mỗi checkpoint là một commit local (English Conventional Commit). Không push, không PR, không chạm DB hosted.

- **CP1** `fix(db): block role escalation via signup metadata and profile updates` — migration + rollback (4.1).
- **CP2** `fix(auth): move the Supabase session to cookies and refresh it in proxy` — 4.2.
- **CP3** `fix(auth): guard server actions and the admin layout on the server` — 4.3, 4.4, 4.5, xoá dead code và dependency.

CP2 gồm cả allowlist `next` và xử lý PKCE ở callback; CP3 gồm cả mật khẩu bắt buộc và UPDATE nguyên tử của payment.

Sau mỗi checkpoint: `npx tsc --noEmit`; cuối CP3: `npm run lint`, `npm run build`. Ghi baseline lint trước CP1 để so sánh.

## 6. Kiểm chứng

Tự động (Sonnet): typecheck, lint so với baseline, build.

Sau khi Main apply migration (Owner duyệt), Main chạy query đọc trên hosted:
- `pg_get_functiondef` của 3 function và trigger mới đúng như file migration.
- Security advisors: hết cảnh báo `function_search_path_mutable` và `handle_new_user` executable.

Ma trận tấn công (Main chạy trên `npm run dev` ở localhost trong browser pane, Owner tự đăng nhập từng tài khoản test; DB là hosted nên chỉ thao tác trên dữ liệu test). Server action được gọi trực tiếp bằng `fetch` với header `Next-Action` lấy từ network log, không qua UI:

| Kiểm tra | Chưa đăng nhập | User thường A | Admin |
|---|---|---|---|
| Mỗi action admin-only (4.4) | lỗi, không đổi dữ liệu | lỗi, không đổi dữ liệu | chạy đúng |
| `createPendingPayment` / `updatePaymentWithCoupon` / `cancelPayment` | lỗi | chạy trên đơn của A; trên đơn `pending` của user B → lỗi, đơn B không đổi | — |
| `cancelPayment` / coupon trên đơn đã `success` của A | — | lỗi, đơn không đổi | — |
| `enrollCourse(id khoá trả phí)` | lỗi | lỗi, không có enrollment | — |
| `sendSuccessEmail` | không còn action ID nào để gọi | — | — |
| supabase-js trong console: `signUp` kèm `data.role='admin'` | role mới = `user` | — | — |
| supabase-js: `update`/`upsert` `profiles.role='admin'` cho chính mình | — | lỗi DB | admin đổi role user test → thành công |
| `/auth/callback?next=javascript:alert(1)`, `?next=https://example.com`, `?next=//example.com` (kèm code hợp lệ) | về `/` | — | — |
| `/auth/callback` không có code / code rác | về `/auth/error`, session hiện có không đổi | về `/auth/error`, vẫn là A | — |
| A đang đăng nhập, mở link recovery của B trên trình duyệt khác với trình duyệt B yêu cầu | — | về `/auth/error`, vẫn là A, không vào trang reset | — |

"Không đổi dữ liệu" được xác nhận bằng query đọc của Main trên dòng test sau mỗi lần gọi.

QA thủ công (Owner, trên hosted, tài khoản test):
1. Đăng ký tài khoản mới bằng UI → role `user`; xác nhận email qua link mới.
2. Admin tạo user mới: thiếu mật khẩu / mật khẩu ngắn → bị chặn; tạo admin với mật khẩu riêng → đăng nhập được, có quyền admin.
3. Đăng nhập/đăng xuất, quên mật khẩu → đặt lại (mở link trên cùng trình duyệt). Mở link ở trình duyệt khác → thấy thông báo lỗi rõ ràng.
4. Khoá free: enroll được. Khoá trả phí: tạo đơn → áp coupon → huỷ / admin duyệt → học được.
5. Truy cập `/admin` khi chưa đăng nhập / bằng user thường / bằng admin.
6. Admin: dashboard, transactions, users (đổi role, tạo user admin, xoá user test), courses/chapters/lessons CRUD, tạo quiz bằng AI.
7. Học bài, quiz, ghi chú, bình luận, notification đánh dấu đã đọc.

Owner tự kiểm tra danh sách tài khoản `role = 'admin'` hiện có trên hosted để chắc chưa ai lợi dụng lỗ hổng, và đổi mật khẩu mọi tài khoản từng được tạo qua trang admin (mật khẩu `123123`).

## 7. Rủi ro

- Session cũ ở localStorage mất → user phải đăng nhập lại (chấp nhận).
- `createBrowserClient` trên server (4.2) — phải chứng minh.
- Trigger chặn role phân biệt sai role gọi → hoặc chặn luôn admin/service role (vỡ A3), hoặc không chặn gì (A2 fail). Phải chứng minh bằng logic SQL và QA bước 2 + 6.
- Thứ tự deploy: migration có thể apply trước code (không phá app hiện tại: admin đổi role qua client vẫn qua `is_admin()`; `createNewUser` cũ sẽ tạo user role `user` cho tới khi code mới deploy). Code mới không phụ thuộc migration. Apply migration càng sớm càng tốt sau khi review PASS.

## Phụ lục A — định nghĩa cũ (để viết rollback)

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
