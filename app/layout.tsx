import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import Header from "./components/Header";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"], // Load các độ đậm cần thiết
});

export const metadata: Metadata = {
  title: "W3Schools Clone",
  description: "Learn to code",
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
        {<Header />}
        <div className="flex flex-1 relative">{children}</div>
      </body>
    </html>
  );
}
