"use client";
import { useState } from "react";
import SidebarContent from "./SidebarContent";
import { type Chapter } from "@/lib/supabase";
import { List, X } from "lucide-react"; // Đổi icon ChevronDown thành List (3 gạch) cho đúng ngữ nghĩa

type MobileSidebarProps = {
  chapters: Chapter[];
  courseSlug: string;
};

export default function MobileSidebar({
  chapters,
  courseSlug,
}: MobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* --- NÚT MỞ MENU (ĐÃ FIX UI) --- */}
      <button
        onClick={() => setIsOpen(true)}
        // 1. lg:hidden: Ẩn trên Desktop
        // 2. fixed bottom-6 right-4: Ghim góc dưới bên phải (dễ bấm bằng ngón cái)
        // 3. Style: Màu xanh, bo tròn, có bóng đổ (shadow-lg)
        className="lg:hidden fixed bottom-6 right-4 z-40 flex items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-full shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all animate-in fade-in zoom-in"
      >
        <List size={20} />
        <span className="font-semibold text-sm">Mục lục</span>
      </button>

      {/* --- OVERLAY & SIDEBAR (Giữ nguyên logic, chỉnh lại animation tí cho mượt) --- */}
      {isOpen && (
        <div className="fixed inset-0 z-100 flex justify-end">
          {/* Lớp phủ đen mờ */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Nội dung Sidebar trượt từ PHẢI sang (cho thuận tay) */}
          <div className="relative w-[85%] max-w-xs bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
            
            {/* Header của Sidebar Mobile */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
              <span className="font-bold text-gray-800 flex items-center gap-2">
                <List size={18} className="text-blue-600"/> 
                Danh sách bài học
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* Phần nội dung chính (SidebarContent) */}
            <div className="flex-1 overflow-y-auto">
              <SidebarContent
                chapters={chapters}
                courseSlug={courseSlug}
                onLinkClick={() => setIsOpen(false)}
              />
            </div>
            
          </div>
        </div>
      )}
    </>
  );
}