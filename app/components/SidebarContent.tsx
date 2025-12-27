"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  supabase,
  getCompletedLessonIds,
  type Chapter,
  getLastAccessedLessonId,
} from "@/lib/supabase";
import { ChevronDown, ChevronRight, Check, FileQuestion } from "lucide-react";

type SidebarContentProps = {
  chapters: Chapter[];
  courseSlug: string;
  onLinkClick?: () => void;
};

// Component Skeleton (Khung xương loading)
const SidebarSkeleton = () => (
  <div className="p-4 space-y-4 animate-pulse w-full">
    {/* Title Skeleton */}
    <div className="h-8 bg-gray-300 rounded w-3/4 mb-6"></div>

    {/* List Skeleton */}
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="space-y-2">
        <div className="h-10 bg-gray-200 rounded w-full"></div>
        <div className="pl-4 space-y-2">
          <div className="h-8 bg-gray-100 rounded w-5/6"></div>
          <div className="h-8 bg-gray-100 rounded w-4/6"></div>
        </div>
      </div>
    ))}
  </div>
);

export default function SidebarContent({
  chapters,
  courseSlug,
}: SidebarContentProps) {
  const pathName = usePathname();

  // State
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const [openChapters, setOpenChapters] = useState<Record<number, boolean>>({});
  const [lastAccessLessonId, setLastAccessLessonId] = useState<number | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true); // Thêm state Loading

  // Toggle mở/đóng chapter
  const toggleChapter = (id: number) => {
    setOpenChapters((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  useEffect(() => {
    let channel: any;

    const initDataAndRealtime = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        // 1. Hàm lấy dữ liệu (Tách ra để tái sử dụng)
        const fetchProgress = async () => {
          const [completed, lastId] = await Promise.all([
            getCompletedLessonIds(user.id),
            getLastAccessedLessonId(user.id, courseSlug),
          ]);

          setCompletedIds(completed);
          if (lastId) setLastAccessLessonId(lastId);
        };

        // Gọi lần đầu
        await fetchProgress();
        setIsLoading(false); // Tắt loading sau khi fetch xong

        // 2. Đăng ký Realtime (Lắng nghe bảng user_progress)
        channel = supabase
          .channel("sidebar_progress_tracking")
          .on(
            "postgres_changes",
            {
              event: "*", // Nghe mọi sự kiện (INSERT, DELETE...)
              schema: "public",
              table: "user_progress",
              filter: `user_id=eq.${user.id}`, // Chỉ nghe của user hiện tại
            },
            () => {
              // Khi có thay đổi -> Gọi lại hàm fetchProgress để cập nhật UI
              console.log("Detect change, refreshing sidebar...");
              fetchProgress();
            }
          )
          .subscribe();
      } catch (error) {
        console.error("Lỗi khởi tạo sidebar:", error);
        setIsLoading(false);
      }
    };

    initDataAndRealtime();

    // Cleanup khi unmount
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [courseSlug]);

  // Render Skeleton nếu đang loading
  if (isLoading) return <SidebarSkeleton />;

  return (
    <div className="flex flex-col bg-gray-100 w-full rounded-xl overflow-hidden h-full">
      {/* Tên khóa học */}
      <h1 className="p-4 text-2xl text-black font-bold uppercase tracking-wide border-b border-gray-200">
        {courseSlug.replace("-", " ")}
      </h1>

      {/* Danh sách chương + bài */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {chapters.map((chapter) => {
          // Logic xác định chapter active
          const isActiveChapter =
            chapter.lessons?.some(
              (l) => pathName === `/learn/${courseSlug}/${l.slug}`
            ) ?? false;

          const isOpen = openChapters[chapter.id] ?? isActiveChapter;

          return (
            <div key={chapter.id} className="select-none">
              {/* Header chương */}
              <button
                type="button"
                onClick={() => toggleChapter(chapter.id)}
                className="w-full flex items-center justify-between px-3 py-3 cursor-pointer hover:bg-white hover:shadow-sm rounded-lg transition-all group"
              >
                <span className="font-bold text-sm text-gray-700 group-hover:text-blue-700">
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
                <div className="mt-1 ml-2 pl-2 border-l-2 border-gray-300 space-y-1 animate-in slide-in-from-top-2 duration-200">
                  {chapter.lessons?.map((lesson) => {
                    const isActive =
                      pathName === `/learn/${courseSlug}/${lesson.slug}`;
                    const quizUrl = `/learn/${courseSlug}/${lesson.slug}/quiz`;
                    const isQuizActive = pathName === quizUrl;
                    const isCompleted = completedIds.includes(lesson.id);

                    // Logic khóa bài học
                    const safeLastId = lastAccessLessonId ?? 0;
                    const isLastAccessLesson =
                      lesson.id <= safeLastId || lesson.id === safeLastId + 1; // Mở khóa bài tiếp theo

                    // Logic check hoàn thành Quiz (Optional - nếu bạn có bảng riêng cho quiz progress)
                    // Hiện tại đang dùng chung completedIds

                    return (
                      <div key={lesson.id} className="flex flex-col mb-1">
                        <Link
                          href={`/learn/${courseSlug}/${lesson.slug}`}
                          className={`flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all ${
                            isActive
                              ? "bg-blue-100 text-blue-700 font-semibold shadow-sm"
                              : "text-gray-600 hover:bg-gray-200 hover:text-black"
                          } ${
                            isLastAccessLesson
                              ? ""
                              : `cursor-not-allowed opacity-50 pointer-events-none select-none grayscale`
                          }`}
                        >
                          <span className="truncate mr-2 flex-1">
                            {lesson.title}
                          </span>

                          {isCompleted && (
                            <div className="bg-green-100 rounded-full p-0.5">
                              <Check
                                size={14}
                                className="text-green-600 shrink-0"
                                strokeWidth={3}
                              />
                            </div>
                          )}
                        </Link>

                        {/* Link Quiz */}
                        {lesson.has_exercise && (
                          <Link
                            href={quizUrl}
                            className={`flex items-center gap-2 px-3 py-1.5 ml-4 mt-0.5 rounded-md text-xs transition-all duration-200 ${
                              isQuizActive
                                ? "bg-purple-100 text-purple-800 font-medium border border-purple-200"
                                : "text-gray-500 hover:bg-white hover:shadow-sm"
                            } ${
                              isLastAccessLesson
                                ? ""
                                : "cursor-not-allowed opacity-50 pointer-events-none"
                            }`}
                          >
                            <FileQuestion
                              size={12}
                              className={
                                isQuizActive
                                  ? "text-purple-600"
                                  : "text-gray-400"
                              }
                            />
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
