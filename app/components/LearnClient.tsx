// app/components/LearnClient.tsx
"use client";
import {
  supabase,
  type Lessons,
  type Chapter,
  checkUserAndHasEnroll,
} from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import CompleteLessonBtn from "@/app/components/CompleteLessonButton";
import NoteManager from "./NoteManager";
import YouTube, { YouTubePlayer } from "react-youtube";

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
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);

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
      if (result.error) {
        toast.error("Có lỗi khi kiểm tra người dùng" + result.error);
        router.push("/");
        return;
      } else {
        if (!result.enrolled) {
          toast.error("Người dùng chưa đăng ký khóa học");
          router.push("/");
          return;
        } else {
          toast.success("Kiểm tra thành công");
          return;
        }
      }
    };

    checkUser();
  }, [router, course]);

  const onPlayerReady = (event: any) => {
    setPlayer(event.target);
  };

  // Trong LearnClient.tsx

  if (loading) {
    return (
      <div className="md:p-8 min-h-screen p-4 w-full bg-gray-50 lg:w-3/4 mx-auto pt-16">
        {/* 1. Breadcrumb giả */}
        <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mb-6"></div>

        <div className="bg-white p-4 md:p-10 rounded-xl shadow-sm border border-gray-200">
          {/* 2. Header giả (Title + Nút Note) */}
          <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
            <div className="h-8 w-2/3 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
          </div>

          {/* 3. Video giả (Cục to nhất) */}
          <div className="mb-8 aspect-video w-full rounded-lg bg-gray-200 animate-pulse"></div>

          {/* 4. Nội dung bài học giả (Mấy dòng text) */}
          <div className="space-y-3">
            <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-4/6 bg-gray-200 rounded animate-pulse"></div>
          </div>

          {/* 5. Nút điều hướng giả */}
          <div className="flex justify-between mt-10 pt-6 border-t border-gray-100">
            <div className="h-12 w-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-12 w-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-12 w-32 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="md:p-8 min-h-screen p-4 w-full bg-gray-50 lg:w-3/4 mx-auto pt-16">
      <div className="text-sm text-gray-500 mb-6">
        Home / Learn /{" "}
        <span className="font-bold text-blue-600">{lesson.title}</span>
      </div>

      <div className="bg-white p-4 md:p-10 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {lesson.title}
          </h1>

          {/* Component NoteManager nằm ở đây -> Sẽ hiện nút Ghi chú */}
          <NoteManager
            userId={currentUser.id}
            lessonId={lesson.id}
            player={player}
          />
        </div>

        {videoId && (
          <div className="mb-8 aspect-video w-full rounded-lg overflow-hidden border border-gray-200 shadow-sm">
            <YouTube
              videoId={videoId}
              onReady={onPlayerReady} // <--- QUAN TRỌNG NHẤT: Cái này giúp lấy player object lưu vào state
              className="w-full h-full"
              iframeClassName="w-full h-full"
              opts={{
                width: "100%",
                height: "100%",
                playerVars: {
                  autoplay: 0,
                  rel: 0, // Tắt video gợi ý liên quan khi hết bài
                  modestbranding: 1,
                },
              }}
            />
          </div>
        )}

        {children}

        <div className="flex flex-col md:flex-row gap-4 justify-center justify-items-center mt-10 pt-6 border-t border-gray-100">
          {prevLesson ? (
            <Link
              href={`/learn/${course}/${prevLesson.slug}`}
              className="w-full md:w-auto border border-gray-300 text-black rounded-md p-4 hover:bg-blue-500 hover:text-white hover:border-blue-500 flex items-center gap-2 transition-colors justify-center"
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
