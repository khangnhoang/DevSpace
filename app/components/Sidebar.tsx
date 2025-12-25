import SidebarContent from "./SidebarContent";
import { type Chapter } from "@/lib/supabase";
type SidebarProps = {
  chapters: Chapter[];
  courseSlug: string;
};

export default function Sidebar({ chapters, courseSlug }: SidebarProps) {
  return (
    // 'hidden lg:flex': Ẩn trên mobile, hiện dạng flex trên desktop
    <aside className="hidden lg:flex h-full lg:top-4rem lg:sticky w-1/4 flex-col fixed inset-y-0 z-50 border-r border-gray-200 bg-[#F3F4F6] shadow-sm">
      <div className="fixed lg:w-1/4">
        <SidebarContent chapters={chapters} courseSlug={courseSlug}/>
        {/* Gọi component con xử lý nội dung */}
      </div>
    </aside>
  );
}