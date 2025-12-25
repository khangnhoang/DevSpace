// app/components/LearnClient.tsx
"use client"; // <--- Bắt buộc dòng này
import { supabase, type Lessons, type Chapter, checkUserAndHasEnroll } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CompleteLessonBtn from "@/app/components/CompleteLessonButton";
import { toast } from "sonner";

// Import các interface cần thiết của bạn (Lesson, Chapter...)
// Ví dụ giả định kiểu dữ liệu:
interface Props {
  lesson: Lessons; // Thay any bằng kiểu Lesson thực của bạn
  chapters: Chapter[];
  course: string;
  slug: string;
  nextLesson: any;
  prevLesson: any;
  videoId: string | null;
  children: React.ReactNode;
}

export default function LearnClient({
  lesson,
  chapters,
  course,
  slug,
  nextLesson,
  prevLesson,
  videoId,
  children,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUserUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      } else {
        setCurrentUserUser(user);
        setLoading(false); // Đã có user, tắt loading để hiện nội dung
      }

      const result = await checkUserAndHasEnroll(user.id, course);
      if(result.error){
        toast.error('Có lỗi khi kiểm tra người dùng' + result.error);
        router.push('/');
        return;
      }
      else{
        if(!result.enrolled){
          toast.error('Người dùng chưa đăng ký khóa học');
          router.push('/');
          return;
        }
        else{
          toast.success('Kiểm tra thành công');
          return;
        }
      }
    };

    checkUser();
  }, [router, course]);

  // Trong lúc đang check user, hiện màn hình Loading để tránh lộ nội dung
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-blue-600 font-semibold">
          Đang kiểm tra quyền truy cập...
        </div>
      </div>
    );
  }

  // --- PHẦN RENDER UI CŨ CỦA BẠN (Copy từ page.tsx cũ vào đây) ---
  return (
    <div className="md:p-8 min-h-screen p-4 w-full bg-gray-50 lg:w-3/4 mx-auto pt-16">
      <div className="text-sm text-gray-500 mb-6">
        Home / Learn /{" "}
        <span className="font-bold text-blue-600">{lesson.title}</span>
      </div>

      <div className="bg-white p-4 md:p-10 rounded-xl shadow-sm border border-gray-200">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 pb-4 border-b">
          {lesson.title}
        </h1>

        {videoId && (
          <div className="mb-8 aspect-video w-full rounded-lg overflow-hidden border border-gray-200 shadow-sm">
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${videoId}`}
              title={lesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        )}

        {children}

        <div className="flex flex-col md:flex-row gap-4 justify-center justify-items-center mt-10 pt-6 border-t border-gray-100">
          {prevLesson ? (
            <Link
              href={`/learn/${course}/${prevLesson.slug}`}
              className="w-full md:w-auto border border-gray-300 text-black rounded-md p-4 hover:bg-blue-500 hover:text-white hover:border-blue-500 flex items-center gap-2 transition-colors"
            >
              <div>Bài trước</div>
            </Link>
          ) : (
            <div />
          )}

          {/* Truyền user.id đã lấy được từ client */}
          <CompleteLessonBtn
            userId={currentUser.id}
            lessonId={lesson.id}
            nextLessonSlug={nextLesson?.slug || null}
            courseSlug={course}
            currentLessonSlug={lesson.slug}
          />

          {nextLesson ? (
            <Link
              href={`/learn/${course}/${nextLesson.slug}`}
              className="text-left border border-gray-300 text-black rounded-md p-4 hover:bg-blue-500 hover:text-white hover:border-blue-500 flex items-center gap-2 transition-colors justify-center"
            >
              <div>Bài sau</div>
            </Link>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}
