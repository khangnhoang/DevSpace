// The activation mail is built here, apart from the nodemailer transport in `email.server.ts`, so a unit test
// can reach it: that file imports `server-only`, which refuses to load outside a React Server bundle.

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// The learner sets their own display name, so every value put into the mail HTML is escaped (SE-P2).
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

// The first lesson when the course has one, else the course page (`/course/<slug>`, BL-P6), else the home page.
export function activationUrl(
  baseUrl: string,
  courseSlug: string,
  firstLessonSlug?: string | null,
): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (!courseSlug) return `${base}/`;
  const course = encodeURIComponent(courseSlug);
  if (firstLessonSlug)
    return `${base}/learn/${course}/${encodeURIComponent(firstLessonSlug)}`;
  return `${base}/course/${course}`;
}

export function activationEmailHtml(
  userName: string,
  courseName: string,
  actionUrl: string,
): string {
  const name = escapeHtml(userName);
  const course = escapeHtml(courseName);
  const href = escapeHtml(actionUrl);
  return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e5e7eb; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
        .button { background-color: #2563eb; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">DevSpace LMS</div>
        </div>
        <div>
            <p>Xin chào <strong>${name}</strong> 👋,</p>
            <p>Chúc mừng! Bạn đã kích hoạt thành công khóa học <strong>"${course}"</strong>.</p>
            <p>Bạn có thể bắt đầu bài học đầu tiên ngay bây giờ:</p>

            <div style="text-align: center;">
                <a href="${href}" class="button">Vào học ngay</a>
            </div>

            <p style="margin-top: 30px; font-size: 13px; color: #6b7280;">Chúc bạn học tập hiệu quả!</p>
        </div>
    </div>
</body>
</html>
`;
}
