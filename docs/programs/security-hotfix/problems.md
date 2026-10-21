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
| P16 | Cập nhật profile khi bỏ trống ngày sinh → `invalid input syntax for type date: ""` (form gửi chuỗi rỗng thay vì `null`). Lỗi có từ trước H1 | Thấp | sau |
| ~~P17~~ | Quy tắc mật khẩu không thống nhất: admin tạo user ≥ 8 ký tự, đăng ký/reset chỉ 6; đặt lại trùng mật khẩu cũ hiện lỗi tiếng Anh `same_password`. Liên quan quy tắc H1 vừa đặt (A11) → sửa trong H1 | Thấp | H1 |
| P18 | Mở link xác nhận đăng ký ở trình duyệt/tab không có code verifier → trang `/auth/error`, dù email đã được xác nhận và đăng nhập được. Gốc là P14 | Thấp | cùng P14 |
| P19 | Nhiều tab `localhost` cùng mở: `supabase-js` dùng `navigator.locks` chung, thao tác auth chờ khoá vô hạn → một tab kẹt làm các tab khác xoay mãi khi đăng nhập. Đóng hết tab là hết. Hành vi của thư viện, không do H1 | Thấp | theo dõi |
| P20 | Kết quả quiz không được lưu (không có bảng), UI không đánh dấu quiz đã hoàn thành như bài học; vào lại phải làm từ đầu | Trung bình | future-features |
| P21 | Xác nhận xoá dùng `window.confirm` (bình luận, CRUD admin courses/chapters/lessons) — xấu, không đồng bộ UI | Thấp | khi áp shadcn (Dialog) |
| P22 | Avatar trong phần đánh giá khoá có thêm nền gradient lạ | Thấp | sau |
| P23 | Notification: không có nút đánh dấu đã đọc cho từng thông báo (phải bấm thẳng vào thông báo), chỉ có nút cho tất cả | Thấp | sau |
| P24 | Tạo quiz bằng AI không chạy: `GEMINI_API_KEY` hết hạn. Việc của Owner (cấp key mới); kèm P-audit gộp 2 SDK Gemini | Thấp | Owner |
| P15 | `/admin/transactions` hiện mọi học viên là "Ẩn danh": trang đọc `p.profiles?.full_name` (`app/admin/transactions/page.tsx:148`) nhưng `getAllPayments` trả về `users`. Lỗi có từ trước H1 (phát hiện khi QA H1) | Thấp | sau |
| P25 | `approvePayment`/`rejectPayment` UPDATE chỉ theo `id`, không lọc `status = 'pending'` → duyệt lại đơn đã xử lý, gửi email lần nữa; enrollment tạo bằng request riêng, lỗi bị bỏ qua | Thấp | **H2-2** |
| P26 | Quiz chấm ở client, user đã enroll nhận `correct_answer` trong payload | Thấp | cùng P20 (chấm trên server) |
| P27 | Comment đã soft-delete vẫn đọc được nội dung qua REST; user chưa enroll vẫn đọc/ghi comment bài trả phí | Thấp | sau |
| P28 | User tự sửa được cột `email` trong `profiles` (email hệ thống gửi theo cột này) | Thấp | sau |
| P29 | "Khóa học của tôi" ở `/profile` chỉ hiện khoá đã hoàn thành ≥ 1 bài (`getUserDashboardData` lọc `isStarted`) → user đã mua nhưng chưa học xong bài nào thấy "Bạn chưa tham gia khóa học nào". Lỗi có từ trước H2 (phát hiện khi QA H2-1) | Thấp | sau |
