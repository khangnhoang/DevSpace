import type { Metadata } from "next";
import "@/app/globals.css";

import Sidebar from "@/app/components/Sidebar";
import MobileSidebar from "@/app/components/MobileSidebar";
import { getCourseOutline } from "@/lib/learn.server";
import type { Chapter } from "@/lib/supabase";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ course: string }>;
}

export const metadata: Metadata = {
  title: "Học trực tuyến",
  description: "Trang học tập",
};

export default async function CourseLayout({ children, params }: LayoutProps) {
  const { course } = await params;
  // The sidebar comes only from a 200 outline. A refusal or a failure leaves it out: the page in the same render
  // redirects, shows not found or shows the unavailable message by its own read, and the layout decides nothing (AC10).
  const outline = await getCourseOutline(course);
  const chapters =
    outline.status === "ok"
      ? (outline.data.chapters as unknown as Chapter[])
      : null;

  return (
    // 1. THÊM 'bg-gray-50' vào đây để đồng bộ màu nền toàn trang
    <div className="flex flex-col lg:flex-row w-full min-h-screen bg-gray-50">
      {/* 2. MAIN CONTENT */}
      <main className="flex-1 order-1 w-full">{children}</main>

      {/* 3. SIDEBAR (Desktop) */}
      {/* Vẫn giữ order-2, border-l.
          SỬA: Tăng lên p-4 cho đẹp. 
          LƯU Ý: bg-gray-50 ở cha sẽ làm nền, còn SidebarContent (bg-gray-100) sẽ nổi lên như 1 cái card.
      */}
      <div className="hidden lg:block order-2 w-full lg:w-[350px] shrink-0 h-[calc(100vh-64px)] sticky top-16 overflow-hidden p-4">
        {chapters && <Sidebar chapters={chapters} courseSlug={course} />}
      </div>

      {/* 4. MOBILE SIDEBAR */}
      {/* SỬA QUAN TRỌNG: Bọc trong div lg:hidden để ẩn tuyệt đối trên Desktop (Fix lỗi ô đen) */}
      <div className="lg:hidden">
        {chapters && <MobileSidebar chapters={chapters} courseSlug={course} />}
      </div>
    </div>
  );
}
