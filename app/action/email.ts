"use server";

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const getEmailTemplate = (userName: string, courseName: string, actionUrl: string) => `
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
            <p>Xin chào <strong>${userName}</strong> 👋,</p>
            <p>Chúc mừng! Bạn đã kích hoạt thành công khóa học <strong>"${courseName}"</strong>.</p>
            <p>Bạn có thể bắt đầu bài học đầu tiên ngay bây giờ:</p>
            
            <div style="text-align: center;">
                <a href="${actionUrl}" class="button">Vào học ngay</a>
            </div>
            
            <p style="margin-top: 30px; font-size: 13px; color: #6b7280;">Chúc bạn học tập hiệu quả!</p>
        </div>
    </div>
</body>
</html>
`;

export async function sendSuccessEmail(
  userEmail: string,
  userName: string,
  courseName: string,
  courseSlug: string,
  firstLessonSlug?: string | null // 👈 Thêm tham số này (Optional)
) {
  try {
    // 1. Lấy Base URL chuẩn (Ưu tiên biến môi trường, fallback về localhost)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL 
      ? process.env.NEXT_PUBLIC_BASE_URL 
      : `http://localhost:3000`; // Hoặc dùng `https://${process.env.VERCEL_URL}` nếu muốn tự động theo Vercel

    // 2. Tạo Link: Nếu có bài học thì vào trang Learn, không thì vào trang chi tiết
    let actionUrl = `${baseUrl}/courses/${courseSlug}`;
    if (firstLessonSlug) {
        actionUrl = `${baseUrl}/learn/${courseSlug}/${firstLessonSlug}`;
    }

    const info = await transporter.sendMail({
      from: `"DevSpace LMS Admin" <${process.env.GMAIL_USER}>`,
      to: userEmail,
      subject: `[Xác nhận] Kích hoạt thành công: ${courseName}`,
      html: getEmailTemplate(userName, courseName, actionUrl),
    });

    console.log("Email sent: %s", info.messageId);
    return { success: true };
  } catch (error) {
    console.error("Lỗi gửi email:", error);
    return { success: false, error };
  }
}