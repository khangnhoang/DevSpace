import type { Metadata } from "next";
import "@/app/globals.css";
import { Inter } from "next/font/google";
import Header from "@/app/components/Header";
import Footer from "../components/Footer";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"], // Load các độ đậm cần thiết
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${inter.className} w-full min-h-screen flex flex-col`}>
      <Header />
      
      {/* flex-1 để nội dung đẩy Footer xuống đáy nếu trang ngắn */}
      <main className="flex-1 w-full bg-gray-50">
        {children}
      </main>

      <Footer />
    </div>
  );
}
