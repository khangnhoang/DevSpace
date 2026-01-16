import type { Metadata } from "next";
import "@/app/globals.css";
import { Inter } from "next/font/google";
import Header from "@/app/components/Header";

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
    <div className={`${inter.className} w-full`}>
      {" "}
      {<Header />}
      <div className="flex flex-1 relative">{children}</div>
    </div>
  );
}
