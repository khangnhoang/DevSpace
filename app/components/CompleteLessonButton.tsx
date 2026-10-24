"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookCheck, Loader2 } from "lucide-react";
import { checkAndSaveProgress } from "@/lib/supabase"; // Đảm bảo hàm này được export từ lib
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface Props {
  userId: string;
  lessonId: number;
  nextLessonSlug: string | null;
  courseSlug: string;
  currentLessonSlug: string;
}

export default function CompleteLessonBtn({
  userId,
  lessonId,
  nextLessonSlug,
  courseSlug,
  currentLessonSlug,
}: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const fireConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const interval: ReturnType<typeof setInterval> = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  };

  const handleFinishLesson = async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      // Gọi hàm lưu tiến độ
      const result = await checkAndSaveProgress(userId, lessonId);

      if (result?.error) {
        toast.error("Có lỗi khi lưu tiến độ");
        return;
      }

      if (result?.hasExercise) {
        toast.info("Bạn cần hoàn thành bài tập trước!");
        // Redirect sang trang làm bài tập (Quiz)
        // Giả sử đường dẫn quiz của bạn là /learn/[course]/[lesson]/quiz
        // Bạn thay đường dẫn bên dưới cho đúng với router của bạn nhé
        router.push(`/learn/${courseSlug}/${currentLessonSlug}/quiz`);
        return; // Dừng lại, không chạy logic bên dưới
      }

      if (result?.saved) {
        toast.success("Đã hoàn thành bài học!");
        router.refresh();
        if (nextLessonSlug) {
          router.push(`/learn/${courseSlug}/${nextLessonSlug}`);
        } else {
          fireConfetti();
          setTimeout(() => {
            router.push(`/learn/${courseSlug}/finish`);
          }, 1500)
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
      className="cursor-pointer text-left border border-gray-300 text-black rounded-md p-4 hover:bg-blue-500 hover:text-white hover:border-blue-500 flex items-center gap-2 transition-colors justify-center min-w-[140px]"
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
