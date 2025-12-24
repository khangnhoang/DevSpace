// app/learn/[course]/[slug]/page.tsx
import { getLessonsByCourse } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import LearnClient from "@/app/components/LearnClient"; // Import component con
import NotFoundLesson from "@/app/components/NotFoundLesson";
import matter from "gray-matter";
import LessonContent from "@/app/components/LessonContent";

// Helper lấy ID Youtube
function getYouTubeId(url: string | null) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export default async function LearnPage({
  params,
}: {
  params: Promise<{ course: string; slug: string }>;
}) {
  const { course, slug } = await params;

  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("slug", slug)
    .single();

  // 2. Xử lý lỗi dữ liệu (không phải lỗi auth)
  if (error || !lesson) {
    return <NotFoundLesson />;
  }

  // 3. Logic bài trước/sau
  const chapters = await getLessonsByCourse(course);
  const allLessons = chapters.flatMap((chapter) => chapter.lessons);
  const currentIndex = allLessons?.findIndex((i) => i.slug === slug) ?? -1;
  const prevLesson = currentIndex > 0 ? allLessons![currentIndex - 1] : null;
  const nextLesson =
    allLessons && currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : null;

  // 4. Xử lý content
  const { content: cleanContent } = matter(lesson.content || "");
  const videoId = getYouTubeId(lesson.video_url);

  // 5. TRẢ VỀ CLIENT COMPONENT (Truyền hết props xuống)
  // LƯU Ý: Không check User ở đây nữa, để Client lo.
  return (
    <LearnClient
      lesson={lesson}
      chapters={chapters}
      course={course}
      slug={slug}
      nextLesson={nextLesson}
      prevLesson={prevLesson}
      videoId={videoId}
    >
    <LessonContent content={cleanContent} />

    </LearnClient>
  );
}
