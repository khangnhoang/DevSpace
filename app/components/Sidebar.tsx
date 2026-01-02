// ✅ CODE MỚI (app/components/Sidebar.tsx)
import SidebarContent from "./SidebarContent";
import { type Chapter } from "@/lib/supabase";

type SidebarProps = {
  chapters: Chapter[];
  courseSlug: string;
};

export default function Sidebar({ chapters, courseSlug }: SidebarProps) {
  // Trả về trực tiếp SidebarContent, không bọc thêm aside/div fixed nào cả
  return (
    <SidebarContent 
      chapters={chapters} 
      courseSlug={courseSlug} 
    />
  );
}