# H1 — Checklist QA thủ công (Owner)

Môi trường: `npm run dev` ở `http://localhost:3000`, DB hosted `lkvxxrxojjlkchzzqidu` (migration H1 đã apply).
Ma trận tấn công (chưa đăng nhập / user A / admin) Main đã chạy xong — xem kết quả trong phiên làm việc 2026-10-21.
Các bước dưới đây tạo tài khoản hoặc dùng email thật nên Owner tự làm. Đánh `[x]` khi đạt, ghi chú khi lỗi.

## 1. Đăng ký kèm role admin (A1)

- [ ] Mở DevTools console trên trang localhost, chạy đoạn sau (thay anon key từ `.env.local`, dùng email test mới):

  ```js
  await fetch("https://lkvxxrxojjlkchzzqidu.supabase.co/auth/v1/signup", {
    method: "POST",
    headers: { apikey: "<ANON_KEY>", "Content-Type": "application/json" },
    body: JSON.stringify({ email: "<email test mới>", password: "<mật khẩu test>", data: { role: "admin" } }),
  }).then((r) => r.status);
  ```

- [ ] Báo Main email đó → Main kiểm tra `profiles.role` phải là `user`.

## 2. Tạo user từ trang admin (A3, A11)

- [x ] `/admin/users` → Thêm người dùng: bỏ trống mật khẩu hoặc nhập < 8 ký tự → bị chặn, hiện cảnh báo.
- [x ] Tạo user role **admin** với mật khẩu riêng ≥ 8 ký tự → thành công.
- [ x] Đăng nhập bằng tài khoản vừa tạo → vào được `/admin`.
- [ x] Tạo user role **user** → đăng nhập được, vào `/admin` bị đưa về `/`.
- [ x] Sửa role một user test trong `/admin/users` → lưu được, role đổi đúng.

## 3. Đăng ký bằng giao diện (A9)

- [x ] `/login` → đăng ký tài khoản mới bằng form.
- [x ] Mở link xác nhận trong email **trên cùng trình duyệt** → về trang chủ, đã đăng nhập. mình tạo bằng tab private nhưng click link bằng tab thường, nó báo hết hạn hoặc không hợp lệ nhưng vẫn đăng nhập được
- [x ] Role của tài khoản mới là `user` (vào `/admin` bị đưa về `/`).

## 4. Quên mật khẩu (A9, A12)

- [ x] `/login` → Quên mật khẩu → nhận email.
- [ x] Mở link **trên cùng trình duyệt** → tới `/auth/reset-password` → đổi mật khẩu → đăng nhập lại bằng mật khẩu mới. -> được nhưng đặt trùng mật khẩu cũ thì nó báo lỗi bằng tiếng anh, mật khẩu 6 ký tự cũng cho, trong admin là 8 ký tự, dùng 1 quy tắc thôi
- [x ] Yêu cầu link mới, mở link ở **trình duyệt khác** (hoặc cửa sổ ẩn danh) → thấy trang `/auth/error` "Liên kết không hợp lệ hoặc đã hết hạn". -> đúng, mới bị ở trên luôn
- [x ] Đang đăng nhập tài khoản X, mở link reset của tài khoản Y trên trình duyệt khác với trình duyệt Y đã yêu cầu → về `/auth/error`, vẫn là X, không vào trang đổi mật khẩu.

## 5. Đăng nhập / phiên (A9)

- [x ] Đăng nhập → reload trang → vẫn đăng nhập.
- [x ] Đăng xuất → reload → đã đăng xuất; vào `/admin` → về `/login`.
- [x ] Header hiện đúng tên/avatar sau khi đăng nhập. -> Lỗi cập nhật: invalid input syntax for type date: "" khi cập nhật avatar, à hiểu rồi, lỗi do bỏ trống dob, có dob thì không lỗi nữa, hiển thị đúng

## 6. Học viên (A6, A9)

- [x ] Enroll khoá **free** (`reactjs` hoặc `cpp`) → thành công, vào học được.
- [x ] Khoá trả phí → bấm đăng ký → hiện form thanh toán (đơn pending), nhập coupon hợp lệ → giá đổi; huỷ → đơn thành "Đã hủy".
- [x ] Học bài, bấm hoàn thành bài → tiến độ cập nhật.
- [x ] Làm quiz → chấm điểm bình thường. -> chưa test được, không có enroll khóa học có quiz, đơn giản -> quiz có chấm, cơ mà có vẻ là không có table để lưu kết quả, ui cũng không có đánh dấu để xác nhận là quiz đã hoàn thành như là bài học, khi vào lại thì bắt đầu làm lại từ đầu
- [x ] Ghi chú: thêm / xoá. 
- [x ] Bình luận: thêm / sửa / xoá. -> xóa mềm ok, tuy nhiên vẫn dùng window confirm, xấu
- [ x] Đánh giá khoá đã enroll. -> avatar thì đúng nhưng tự nhiên có thêm cái nền màu chuyển? 
- [ x] Notification (admin): bấm đánh dấu đã đọc → mất chấm đỏ. -> giờ bấm thẳng vào thông báo để đánh dấu, không có nút/nút dạng text riêng cho từng thông báo để đánh dấu, có một nút nhưng là cho tất cả thông báo

## 7. Admin (A3, A4, A8)

- [x ] `/admin` dashboard hiện số liệu, biểu đồ, top học viên, hoạt động gần đây.
- [ x] `/admin/transactions`: duyệt một đơn pending test → thành công, học viên nhận email; từ chối một đơn → "Đã hủy". (Tên học viên hiện "Ẩn danh" là lỗi cũ P15, không phải do H1.)
- [x ] `/admin/courses`, `/admin/chapters`, `/admin/lessons`: thêm / sửa / xoá một mục test. -> vẫn còn dùng window confirm
- [ ] `/admin/lessons`: tạo quiz bằng AI → có câu hỏi. -> không dùng được, api key hết hạn rồi

## 8. Dọn dẹp và tài khoản cũ

- [ x] Kiểm tra danh sách tài khoản `role = 'admin'` trên dashboard Supabase — không có tài khoản lạ.
- [x ] Đổi mật khẩu mọi tài khoản từng được tạo qua trang admin (mật khẩu cũ `123123`).
- [x ] Xoá dữ liệu test nếu không muốn giữ: đơn `84`, `85` và enrollment khoá `javascript` của user A, các tài khoản test vừa tạo.
- [ ] (Tuỳ chọn) Bật Leaked password protection trong Auth settings (P9). -> là gì nhỉ?

## Kết quả

| Mục | Đạt / Lỗi | Ghi chú |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |
| 5 | | |
| 6 | | |
| 7 | | |
| 8 | | |
