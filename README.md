# 🚀 DevSpace – Nền tảng Đào tạo & Luyện Code Trực tuyến (LMS)

**DevSpace** là hệ thống quản lý học tập (LMS) phục vụ đào tạo lập trình trực tuyến, được xây dựng như đồ án tốt nghiệp chuyên ngành Công nghệ Thông tin. Hệ thống cung cấp đầy đủ chức năng từ học tập tương tác, luyện code trực tuyến, thanh toán, đến quản trị và thống kê dữ liệu.

## 🌐 Demo trực tuyến

Hệ thống đã được triển khai trên môi trường production:

- **Production:** https://devspace-lms.vercel.app

Lưu ý: Một số tác vụ gửi email có thể chậm ở request đầu tiên do cơ chế serverless.

## ✨ Tính năng chính

### 👤 Dành cho Học viên

* Đăng ký, đăng nhập, quên mật khẩu, xác thực email
* Xem, tìm kiếm, lọc và ghi danh khóa học
* Thanh toán và quản lý lịch sử đơn hàng
* Học tập với bài học Video và Văn bản (MDX)
* Ghi chú realtime đồng bộ theo thời gian video
* Trình biên dịch code online (HTML / CSS / JavaScript / C++)
* Bình luận và thảo luận trong từng bài học
* Trang cá nhân, theo dõi tiến độ học tập
* Đánh giá khóa học (chỉ khi đã mua, mỗi khóa 1 lần)

### 🛠️ Dành cho Quản trị viên

* Dashboard thống kê doanh thu, người dùng, khóa học
* Quản lý khóa học, chương (chapters), bài học (lessons)
* Quản lý người dùng và phân quyền
* Theo dõi giao dịch và lịch sử thanh toán

## 🏗️ Công nghệ sử dụng

* **Frontend:** Next.js 16 và React 19 (App Router), TypeScript, Tailwind CSS
* **Backend & Database:** Supabase (PostgreSQL)
* **AI Integration:** Google Gemini API
* **Email Service:** Nodemailer (SMTP Gmail)
* **Bảo mật:** Row Level Security (RLS), Middleware bảo vệ route

## 📁 Cấu trúc thư mục dự án

```text
MY-W3SCHOOLS
├── app/
│   ├── (main)/                 # Giao diện chính cho học viên
│   │   ├── course/             # Danh sách & chi tiết khóa học
│   │   ├── learn/              # Màn hình học (video, notes, compiler)
│   │   ├── login/              # Trang đăng nhập
│   │   ├── profile/            # Trang cá nhân & tiến độ học tập
│   │   └── try_it/             # Trình biên dịch code độc lập
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── action/                 # Server Actions (logic backend)
│   │   ├── admin-dashboard.ts
│   │   ├── email.ts
│   │   ├── enroll.ts
│   │   ├── gemini.ts
│   │   ├── get-notifications.ts
│   │   ├── payment.ts
│   │   └── user.ts
│   │
│   ├── admin/                  # Giao diện quản trị
│   │   ├── chapters/
│   │   ├── courses/
│   │   ├── lessons/
│   │   ├── transactions/
│   │   ├── users/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── auth/                   # Xác thực & bảo mật
│   │   ├── callback/
│   │   └── reset-password/
│   │
│   ├── components/             # Components dùng chung
│   ├── globals.css
│   ├── layout.tsx
│   └── not-found.tsx
│
├── lib/                         # Cấu hình Supabase & helper functions
├── public/                      # Tài nguyên tĩnh
├── .env.local                   # Biến môi trường
├── .gitignore
├── eslint.config.mjs
└── package.json
```

## 🗄️ Cơ sở dữ liệu

Hệ thống sử dụng **14 bảng chính**:
`users`, `profiles`, `courses`, `chapters`, `lessons`, `enrollments`,
`payments`, `notes`, `comments`, `reviews`, `user_progress`, …

* Thiết lập **unique constraints** để tránh race condition
* Chỉ cho phép học viên đã ghi danh mới được đánh giá khóa học

## ⚙️ Cài đặt & chạy demo

### 1. Cài đặt thư viện

```bash
npm install
```

### 2. Môi trường

File môi trường là của Owner, không nằm trong repo và không cần mở hay sửa. Lệnh chạy Supabase local (Docker Desktop phải đang chạy) nằm ở mục Commands của [CLAUDE.md](CLAUDE.md).

### 3. Chạy ứng dụng

```bash
npx supabase start
npx supabase db reset
npm run dev
```

`npm run dev` chạy trên Supabase local và báo lỗi nếu Supabase local chưa chạy.

Truy cập: [http://127.0.0.1:3000](http://127.0.0.1:3000)

## 🔐 Tài khoản demo

Ba tài khoản seed của Supabase local (mật khẩu nằm trong `supabase/seed.sql`):

* **Learner:** learner@devspace.test
* **Student:** student@devspace.test
* **Admin:** admin@devspace.test

## ⚠️ Lưu ý

* Hệ thống xử lý race condition ở tầng database
* Mỗi học viên chỉ được đánh giá mỗi khóa học **1 lần duy nhất**

## Shared agent skills

`.claude/skills/` is the source of truth. Each entry in `.agents/skills/` is a
relative directory symlink to `../../.claude/skills/<name>`, so Claude Code and
Codex read the same instructions, references and scripts. Edit the source only;
when adding a skill, add its corresponding symlink too. Preserve and inspect any
existing destination before replacing it.

On Windows, enable Developer Mode and clone with symlink support:

```bash
git clone -c core.symlinks=true https://github.com/khangnhoang/DevSpace.git
```

The repository-local Git setting does not transfer to another clone. With
`core.symlinks=false`, Git checks out links as text files, which agents cannot
use as skill directories. For an existing checkout, enable
`git config --local core.symlinks true` and recreate only the affected link
entries after preserving any local changes. Git must record each link with mode
`120000`, not as a copied directory or a Windows junction.

Run `npm run docs:check` to validate the canonical skills. In a session opened
at the repository root, check `/skills` in Claude Code and the skill selector in
Codex; restart the session if newly added skills do not appear. Sharing these
files does not make agent-specific tools available in another agent.

References: [Codex skill discovery](https://learn.chatgpt.com/docs/build-skills),
[Claude Code skills](https://code.claude.com/docs/en/skills),
[Git symlink configuration](https://git-scm.com/docs/git-config#Documentation/git-config.txt-coresymlinks).

© 2026 DevSpace LMS Project

