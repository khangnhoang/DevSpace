import "server-only";

import nodemailer from "nodemailer";

import { activationEmailHtml, activationUrl } from "@/lib/activation-email";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

export async function sendSuccessEmail(
  userEmail: string,
  userName: string,
  courseName: string,
  courseSlug: string,
  firstLessonSlug?: string | null, // 👈 Thêm tham số này (Optional)
) {
  try {
    // 1. Lấy Base URL chuẩn (Ưu tiên biến môi trường, fallback về localhost)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      ? process.env.NEXT_PUBLIC_BASE_URL
      : `http://localhost:3000`; // Hoặc dùng `https://${process.env.VERCEL_URL}` nếu muốn tự động theo Vercel

    // 2. Link: the first lesson, else the course page (lib/activation-email.ts)
    const actionUrl = activationUrl(baseUrl, courseSlug, firstLessonSlug);

    const info = await transporter.sendMail({
      from: `"DevSpace LMS Admin" <${process.env.GMAIL_USER}>`,
      to: userEmail,
      subject: `[Xác nhận] Kích hoạt thành công: ${courseName}`,
      html: activationEmailHtml(userName, courseName, actionUrl),
    });

    console.log("Email sent: %s", info.messageId);
    return { success: true };
  } catch (error) {
    console.error("Lỗi gửi email:", error);
    return { success: false, error };
  }
}
