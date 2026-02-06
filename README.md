---

# 🚀 DevSpace – Nền tảng Đào tạo & Luyện Code Trực tuyến (LMS)

**DevSpace** là hệ thống quản lý học tập (LMS) phục vụ đào tạo lập trình trực tuyến, được xây dựng như đồ án tốt nghiệp chuyên ngành Công nghệ Thông tin. Hệ thống tích hợp đầy đủ từ quản lý khóa học, học tập tương tác, thanh toán, đến quản trị và thống kê.

## ✨ Tính năng chính

### 👤 Học viên

* Đăng ký, đăng nhập, quên mật khẩu, xác thực email
* Xem, tìm kiếm, lọc và ghi danh khóa học
* Thanh toán và quản lý lịch sử đơn hàng
* Học tập tương tác với video và bài viết (MDX)
* Ghi chú realtime đồng bộ theo thời gian video
* Trình biên dịch code online (HTML/CSS/JS, C++)
* Bình luận, thảo luận trong bài học
* Trang cá nhân, theo dõi tiến độ học tập
* Đánh giá và nhận xét khóa học (chỉ khi đã mua)

### 🛠️ Quản trị viên

* Dashboard thống kê doanh thu, người dùng, khóa học
* Quản lý khóa học, chương, bài học
* Quản lý người dùng và phân quyền
* Theo dõi giao dịch và doanh thu hệ thống

## 🏗️ Công nghệ sử dụng

* **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
* **Backend & Database:** Supabase (PostgreSQL)
* **AI:** Google Gemini API (trợ lý học tập)
* **Email:** Nodemailer (SMTP Gmail)
* **Bảo mật:** Row Level Security (RLS), Middleware protection

## 📁 Cấu trúc thư mục (rút gọn)

* `app/` – Giao diện người dùng, admin, auth, API, server actions
* `components/` – UI components tái sử dụng
* `lib/` – Tiện ích và cấu hình Supabase
* `public/` – Tài nguyên tĩnh

## 🗄️ Cơ sở dữ liệu

Hệ thống gồm 14 bảng chính:
`users`, `profiles`, `courses`, `chapters`, `lessons`, `enrollments`, `payments`, `notes`, `comments`, `reviews`, `user_progress`, …

Có ràng buộc toàn vẹn dữ liệu để xử lý race condition và đảm bảo mỗi học viên chỉ đăng ký/đánh giá hợp lệ.

## ⚙️ Cài đặt & chạy demo

### 1. Cài đặt thư viện

```bash
npm install
```

### 2. Kiểm tra file `.env.local`

File đã được cấu hình sẵn Supabase, Gemini API và Email Service.

### 3. Chạy ứng dụng

```bash
npm run dev
```

Truy cập: [http://localhost:3000](http://localhost:3000)

## 🔐 Tài khoản demo

* **Admin:** [admin@devspace.com](mailto:admin@devspace.com) / 123456
* **Student:** [student@devspace.com](mailto:student@devspace.com) / 123456

## ⚠️ Lưu ý

* Hệ thống xử lý race condition bằng ràng buộc unique ở database
* Chỉ học viên đã mua khóa học mới được đánh giá và mỗi khóa chỉ đánh giá 1 lần

© 2026 DevSpace LMS Project

---

nói 1 câu là tôi làm tiếp cho 😎
