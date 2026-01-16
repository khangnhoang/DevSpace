import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"], // Load các độ đậm cần thiết
});

export const metadata: Metadata = {
  title: {
    template: "%s | DevSpace LMS", // Các trang con sẽ điền vào chỗ %s
    default: "DevSpace - Nền tảng Học Lập trình Trực tuyến", // Trang chủ hiện cái này
  },
  description:
    "Hệ thống quản lý học tập tích hợp trình biên tập code trực tuyến và lộ trình thông minh.",
  
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.className} w-full`}>
        {" "}
        <div className="">{children}</div>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
