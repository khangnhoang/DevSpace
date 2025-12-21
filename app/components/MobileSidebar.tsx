'use client'
import { useState } from "react";
import SidebarContent from "./SidebarContent";
import { type Chapter } from "@/lib/supabase";
import { ChevronDown, X } from "lucide-react";

type MobileSidebarProps = {
  chapters: Chapter[];
  courseSlug: string;
};

export default function MobileSidebar({ 
  chapters,
  courseSlug
}: MobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Nút mở Menu (Luôn hiện để test trong preview này, thực tế sẽ là lg:hidden) */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed left-auto z-40 p-2 bg-white rounded-md shadow-md border border-gray-200 hover:bg-gray-50"
      >
        <ChevronDown size={24} className="text-gray-700" />
      </button>

      {/* Overlay & Sidebar */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Lớp phủ đen mờ (Click vào đây để đóng) */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Nội dung Sidebar trượt ra */}
          <div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Nút đóng X */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full z-50"
            >
              <X size={20} className="text-gray-500" />
            </button>

            {/* Gọi lại SidebarContent, truyền thêm hàm đóng menu */}
            <SidebarContent 
              chapters={chapters} 
              courseSlug={courseSlug} 
              onLinkClick={() => setIsOpen(false)} 
            />
          </div>
        </div>
      )}
    </>
  );
}