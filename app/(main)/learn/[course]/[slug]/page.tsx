// app/learn/[course]/[slug]/page.tsx
import { getLessonsByCourse, supabase } from "@/lib/supabase";
import LessonContent from "@/app/components/LessonContent";
import NotFoundLesson from "@/app/components/NotFoundLesson";
import Link from "next/link";
import matter from "gray-matter";

interface Props {
  params: Promise<{ course: string; slug: string }>;
}

// --- HELPER: Tách ID Youtube từ link (để nhúng) ---
function getYouTubeId(url: string | null) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export default async function LearnPage({ params }: Props) {
  const { course, slug } = await params;

  // --- GỌI DATABASE ---
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("slug", slug)
    .single();

  // --- XỬ LÝ LỖI ---
  if (error || !lesson) {
    return <NotFoundLesson />;
  }

  // --- LOGIC ĐIỀU HƯỚNG (Next/Prev) ---
  const chapters = await getLessonsByCourse(course);
  // Flatten danh sách chương thành danh sách bài học
  const allLessons = chapters.flatMap((chapter) => chapter.lessons);
  
  const currentIndex = allLessons?.findIndex((i) => i.slug === slug) ?? -1;
  const prevLesson = currentIndex > 0 ? allLessons![currentIndex - 1] : null;
  const nextLesson =
    allLessons && currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : null;

  // --- XỬ LÝ NỘI DUNG ---
  // Thêm "|| ''" để tránh lỗi nếu content trong DB là null
  const { content: cleanContent } = matter(lesson.content || "");
  
  // Lấy Video ID
  const videoId = getYouTubeId(lesson.video_url);

  return (
    //className="md:p-8 min-h-screen p-4 w-full bg-gray-50 lg:w-3/4 mx-auto"
    <div className="md:p-8 min-h-screen p-4 w-full bg-gray-50 lg:w-3/4 mx-auto pt-16">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 mb-6">
        Home / Learn /{" "}
        <span className="font-bold text-blue-600">{lesson.title}</span>
      </div>

      {/* Khung nội dung chính */}
      <div className="bg-white p-4 md:p-10 rounded-xl shadow-sm border border-gray-200">
        
        {/* Tiêu đề bài học */}
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 pb-4 border-b">
          {lesson.title}
        </h1>

        {/* --- [MỚI] PHẦN HIỂN THỊ VIDEO --- */}
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

        {/* Nội dung bài viết (Markdown) */}
        <LessonContent content={cleanContent} />

        {/* Nút điều hướng */}
        <div className="flex flex-col md:flex-row gap-4 justify-center justify-items-center mt-10 pt-6 border-t border-gray-100">
          {prevLesson ? (
            <Link
              href={`/learn/${course}/${prevLesson.slug}`}
              className="w-full md:w-auto border border-gray-300 text-black rounded-md p-4 hover:bg-blue-500 hover:text-white hover:border-blue-500 flex items-center gap-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              <div>
                <div className="text-xs opacity-60 text-left">Bài trước</div>
                <div className="font-semibold">{prevLesson.title}</div>
              </div>
            </Link>
          ) : (
            <div />
          )}

          {nextLesson ? (
            <Link
              href={`/learn/${course}/${nextLesson.slug}`}
              className="text-left border border-gray-300 text-black rounded-md p-4 hover:bg-blue-500 hover:text-white hover:border-blue-500 flex items-center gap-2 transition-colors justify-center"
            >
              <div>
                <div className="text-xs opacity-60">Bài sau</div>
                <div className="font-semibold">{nextLesson.title}</div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}