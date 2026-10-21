# Security hotfix — vấn đề ngoài phạm vi H1

Phát hiện ngày 2026-10-21 khi đọc code và metadata DB hosted. Mục có dấu **H2** sẽ làm ngay sau H1.

| # | Vấn đề | Mức | Dự kiến |
|---|---|---|---|
| P1 | `profiles` SELECT `true` cho `public`: anon đọc được email, phone, dob, gender, province của mọi người | Cao | **H2** |
| P2 | `coupons` SELECT `true` cho `public`: liệt kê được mọi mã; `CoursePaymentModal` kiểm tra coupon ngay ở client | Trung bình | **H2** |
| P3 | Policy INSERT `reviews` chỉ kiểm tra enroll, không ràng buộc `user_id = auth.uid()` → review giả danh người khác | Trung bình | **H2** |
| P4 | Policy UPDATE `comments` không có `with_check` → chủ comment đổi được `user_id` | Thấp | **H2** |
| P5 | Code gọi RPC `increment_coupon_usage` nhưng function không tồn tại trên DB → lượt dùng coupon không bao giờ tăng | Trung bình | H2 hoặc sau |
| P6 | Coupon được tính lượt khi tạo đơn pending, `updatePaymentWithCoupon` thì không → logic lượt dùng không nhất quán | Thấp | sau |
| P7 | Server component đọc dữ liệu bằng client anon, không theo user | Thấp | program test-infra / migration |
| P8 | Auth dùng implicit flow; nên chuyển PKCE | Thấp | migration |
| P9 | Leaked password protection đang tắt (Auth settings) | Thấp | Owner bật trên dashboard |
| P10 | Bucket `avatars`: mọi user đăng nhập upload được vào bất kỳ path nào | Thấp | sau |
| P11 | pg_graphql phơi toàn bộ bảng cho anon/authenticated (advisor 0026/0027) | Thấp | sau |
| ~~P12~~ | Mật khẩu cố định `123123` khi admin tạo user — đã đưa vào H1 theo Codex review round 1 | Cao | H1 |
| P13 | Nội dung lesson/quiz trả phí đọc được không cần enroll: RLS `lessons`/`exercises` SELECT `true`; trang learn query toàn bộ lesson trên server, kiểm tra enroll ở client (`LearnClient.tsx`) sau khi dữ liệu đã nằm trong RSC payload | Cao | **H2** (Owner: tách H2-1/H2-2 nếu lớn) |
| P14 | Link email chỉ mở được trên trình duyệt đã yêu cầu (PKCE); nên chuyển sang `token_hash` + `verifyOtp` qua route server | Thấp | sau |
