// app/components/LearnClient.tsx
"use client";
import {
  supabase,
  type Lessons,
  type Chapter,
  checkUserAndHasEnroll,
  getLastAccessedLessonId,
  getCompletedLessonIds,
} from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import CompleteLessonBtn from "@/app/components/CompleteLessonButton";
import NoteManager from "./NoteManager";
import YouTube, { YouTubePlayer, YouTubeEvent } from "react-youtube";
import {
  type PrevLesson,
  type NextLesson,
} from "../(main)/learn/[course]/[slug]/page";
import { User } from "@supabase/supabase-js";
import { Code, MessageSquareText } from "lucide-react";
import LessonComments from "./LessonComments";

interface Props {
  lesson: Lessons;
  chapters: Chapter[];
  course: string;
  slug: string;
  nextLesson: NextLesson;
  prevLesson: PrevLesson;
  videoId: string | null;
  children: React.ReactNode;
}

export default function LearnClient({
  lesson,
  course,
  nextLesson,
  prevLesson,
  videoId,
  children,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkAccess = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (!user) {
          toast.warning("Bạn phải đăng nhập để vào học");
          router.push("/login");
          return;
        }

        const result = await checkUserAndHasEnroll(user.id, course);
        if (result.error) {
          toast.error("Có lỗi khi kiểm tra người dùng" + result.error);
          router.push("/");
          return;
        }

        if (!isMounted) return;

        if (!result.enrolled) {
          toast.error("Bạn chưa đăng ký khóa học này!");
          router.push("/");
          return;
        }

        const [completedIds, allowedLessonId] = await Promise.all([
          getCompletedLessonIds(user.id),
          getLastAccessedLessonId(user.id, course),
        ]);

        const isCompleted = completedIds.includes(lesson.id);
        const isAllowed = isCompleted || lesson.id === allowedLessonId;

        if (!isAllowed && allowedLessonId) {
          toast.error("Bạn chưa học đến bài này, vui lòng học theo khóa học");

          const { data: allowedLessonData } = await supabase
            .from("lessons")
            .select("slug")
            .eq("id", allowedLessonId)
            .maybeSingle();

          if (allowedLessonData) {
            router.replace(`/learn/${course}/${allowedLessonData.slug}`);
          }
          return;
        }

        setCurrentUser(user);
        setLoading(false);
      } catch (error) {
        console.error(error);
        if (isMounted) {
          toast.error("Có lỗi xảy ra");
          router.push("/");
        }
      }
    };

    checkAccess();

    return () => {
      isMounted = false;
    };
  }, [router, course, lesson.id]);

  const onPlayerReady = (event: YouTubeEvent) => {
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

  if (!currentUser) {
    return null;
  }

  return (
    <div className="w-full min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="text-sm text-gray-500 mb-6">
        Home / Learn /{" "}
        <span className="font-bold text-blue-600">{lesson.title}</span>
      </div>

      <div className="bg-white p-4 md:p-10 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {lesson.title}
          </h1>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowComments(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:text-blue-600 hover:border-blue-400 transition-all font-medium text-sm shadow-sm group"
            >
              <MessageSquareText
                size={18}
                className="group-hover:scale-110 transition-transform"
              />
              <span className="hidden sm:inline">Thảo luận</span>
            </button>

            {/* Nút Try It Yourself */}
            <Link
              href="/try_it"
              target="_blank" // Mở tab mới để không mất video đang xem
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm shadow-sm"
            >
              <Code size={18} />
              Try It
            </Link>

            {/* Nút Ghi chú cũ */}
            <NoteManager
              userId={currentUser.id}
              lessonId={lesson.id}
              player={player}
            />
          </div>
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
                  origin:
                    typeof window !== "undefined"
                      ? window.location.origin
                      : undefined,
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
      <LessonComments
        lessonId={lesson.id}
        isOpen={showComments}
        onClose={() => setShowComments(false)}
      />
    </div>
  );
}
