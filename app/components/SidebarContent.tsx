"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase, getCompletedLessonIds, type Chapter } from "@/lib/supabase";
import {
  ChevronDown,
  ChevronRight,
  Check,
  FileQuestion,
  BookOpen,
} from "lucide-react";

type SidebarContentProps = {
  chapters: Chapter[]; // ✅ nhận CHAPTER từ getLessonsByCourse
  courseSlug: string;
  onLinkClick?: () => void;
};

export default function SidebarContent({
  chapters,
  courseSlug,
}: SidebarContentProps) {
  const pathName = usePathname();

  // Bài đã hoàn thành
  const [completedIds, setCompletedIds] = useState<number[]>([]);

  // State chỉ lưu các chapter user đã TỰ toggle (true/false)
  const [openChapters, setOpenChapters] = useState<Record<number, boolean>>({});

  // Toggle mở/đóng chapter
  const toggleChapter = (id: number) => {
    setOpenChapters((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Lấy tiến độ học từ Supabase (ngoại hệ thống → dùng effect là đúng)
  useEffect(() => {
    const fetchProgress = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const result = await getCompletedLessonIds(session.user.id);
        setCompletedIds(result);
      } else {
        console.log("Bạn chưa đăng nhập");
      }
    };

    fetchProgress();
  }, []);

  return (
    <div className="flex flex-col bg-gray-100 w-full rounded-xl shadow-2xl overflow-hidden">
      {/* Tên khóa học */}
      <h1 className="p-4 text-2xl text-black font-bold uppercase tracking-wide">
        {courseSlug.replace("-", " ")}
      </h1>

      {/* Danh sách chương + bài */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {chapters.map((chapter) => {
          // Chapter này có chứa bài đang active không?
          const isActiveChapter =
            chapter.lessons?.some(
              (l) => pathName === `/learn/${courseSlug}/${l.slug}`
            ) ?? false;

          // Nếu user chưa toggle thì mặc định MỞ chapter đang active
          const isOpen = openChapters[chapter.id] ?? isActiveChapter;

          return (
            <div key={chapter.id} className="select-none">
              {/* Header chương */}
              <button
                type="button"
                onClick={() => toggleChapter(chapter.id)}
                className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-200 rounded-md transition-colors group"
              >
                <span className="font-bold text-sm text-gray-700 group-hover:text-black">
                  {chapter.title}
                </span>
                {isOpen ? (
                  <ChevronDown size={16} className="text-gray-500" />
                ) : (
                  <ChevronRight size={16} className="text-gray-500" />
                )}
              </button>

              {/* Danh sách bài trong chương */}
              {isOpen && (
                <div className="mt-1 ml-2 pl-2 border-l-2 border-gray-300 space-y-1">
                  {chapter.lessons?.map((lesson) => {
                    const isActive =
                      pathName === `/learn/${courseSlug}/${lesson.slug}`;
                    const lessonUrl = `/learn/${courseSlug}/${lesson.slug}`;
                    const quizUrl = `/learn/${courseSlug}/${lesson.slug}/quiz`;

                    const isQuizActive = pathName === quizUrl;
                    const isCompleted = completedIds.includes(lesson.id);

                    return (
                      <div key={lesson.id} className="flex flex-col">
                        <Link
                          href={`/learn/${courseSlug}/${lesson.slug}`}
                          className={`flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all ${
                            isActive
                              ? "bg-blue-100 text-blue-700 font-semibold"
                              : "text-gray-700 hover:bg-gray-100 hover:text-black"
                          }`}
                        >
                          <span className="truncate mr-2">{lesson.title}</span>

                          {isCompleted && (
                            <Check
                              size={16}
                              className="text-green-600 flex-shrink-0"
                              strokeWidth={3}
                            />
                          )}
                        </Link>

                        {lesson.has_exercise && (
                          <Link
                            href={quizUrl}
                            className={`flex items-center gap-2 px-3 py-1.5 ml-4 mt-0.5 rounded-md text-xs transition-all duration-200 ${
                              isQuizActive
                                ? "bg-purple-100 text-purple-800 font-medium border border-purple-200"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                          >
                            <FileQuestion size={12} className={isQuizActive ? "text-purple-600" : "text-gray-400"} />
                            <span>Bài tập thực hành</span>
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
