// app/learn/[course]/[slug]/page.tsx
import { getLessonsByCourse, supabase } from "@/lib/supabase";
import LessonContent from "@/app/components/LessonContent";
import NotFoundLesson from "@/app/components/NotFoundLesson";
import Link from "next/link";

interface Props {
  params: Promise<{ course: string, slug: string }>;
}

// Nhớ thêm 'async'
export default async function LearnPage({ params }: Props) {
  const { course, slug } = await params;

  // --- GỌI DATABASE (REAL DATA) ---
  const { data: lesson, error } = await supabase
    .from("lessons") // Tên bảng trong ảnh bạn gửi
    .select("*") // Lấy hết cột
    .eq("slug", slug) // WHERE slug = ...
    .single(); // LIMIT 1

  // --- XỬ LÝ LỖI ---
  if (error || !lesson) {
    return <NotFoundLesson />;

    // Cách 2 (Nâng cao): Chuyển thẳng sang trang Not Found mặc định của Next.js
    // return notFound();
  }

  const allLessons = await getLessonsByCourse(course)

  const currentIndex = allLessons?.findIndex((i) => i.slug === slug) ?? -1
  const prevLesson = currentIndex > 0? allLessons![currentIndex - 1] : null;
  const nextLesson = (allLessons && currentIndex< allLessons.length-1)? allLessons[currentIndex + 1] : null
  
  

  return (
    <div className="w-full p-8 min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 mb-6">
        Home / Learn /{" "}
        <span className="font-bold text-blue-600">{lesson.title}</span>
      </div>

      {/* Khung nội dung */}
      <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-200">
        {/* Tiêu đề bài học lấy từ DB */}
        <h1 className="text-3xl font-bold text-gray-900 mb-6 pb-4 border-b">
          {lesson.title}
        </h1>

        {/* Nội dung Markdown render qua MDX */}
        <LessonContent content={lesson.content} />
        <div className="flex gap-4 justify-center justify-items-center">
          {prevLesson ? (
            <Link
              href={`/learn/${course}/${prevLesson.slug}`}
              className="border border-gray-300 text-black rounded-md p-4 hover:bg-blue-500 hover:text-white hover:border-blue-500 flex items-center gap-2 transition-colors"
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
            <div /> // Div rỗng để giữ chỗ nếu không có bài trước
          )}
          {nextLesson ? (
            <Link
              // Sửa: Gắn link động
              href={`/learn/${course}/${nextLesson.slug}`}
              className="border border-gray-300 text-black rounded-md p-4 hover:bg-blue-500 hover:text-white hover:border-blue-500 flex items-center gap-2 transition-colors text-right"
            >
              <div>
                <div className="text-xs opacity-60 text-right">Bài sau</div>
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
