"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookCheck, Loader2 } from "lucide-react";
import { checkAndSaveProgress } from "@/lib/supabase"; // Đảm bảo hàm này được export từ lib
import { toast } from "sonner";

interface Props {
  userId: string;
  lessonId: number;
  nextLessonSlug: string | null;
  courseSlug: string;
}

export default function CompleteLessonBtn({ userId, lessonId, nextLessonSlug, courseSlug }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleFinishLesson = async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      // Gọi hàm lưu tiến độ
      // Lưu ý: checkAndSaveProgress cần được sửa lại để nhận tham số userId, lessonId như thảo luận trước
      const result = await checkAndSaveProgress(userId, lessonId);

      if (result?.error) {
        toast.error("Có lỗi khi lưu tiến độ");
      } else {
        toast.success("Đã hoàn thành bài học!");
        
        // Chuyển trang sau khi lưu xong
        if (nextLessonSlug) {
          router.push(`/learn/${courseSlug}/${nextLessonSlug}`);
        } else {
          // Nếu là bài cuối cùng
          router.push(`/learn/${courseSlug}`); // Hoặc trang chúc mừng
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi hệ thống");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleFinishLesson}
      disabled={isLoading}
      className="text-left border border-gray-300 text-black rounded-md p-4 hover:bg-blue-500 hover:text-white hover:border-blue-500 flex items-center gap-2 transition-colors justify-center min-w-[140px]"
    >
      {isLoading ? (
        <Loader2 className="animate-spin" size={26} />
      ) : (
        <>
          <div>
            <div className="text-xs opacity-60">Hoàn thành</div>
            <div className="font-semibold">Đến bài sau</div>
          </div>
          <BookCheck size={26} />
        </>
      )}
    </button>
  );
}