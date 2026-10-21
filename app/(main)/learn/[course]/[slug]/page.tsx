// app/learn/[course]/[slug]/page.tsx
import { redirect } from "next/navigation";
import { getLessonsByCourse } from "@/lib/supabase";
import { requireCourseAccess } from "@/lib/auth.server";
import { createSupabaseServerClient } from "@/lib/supabase.server";
import { supabaseAdmin } from "@/lib/supabase.admin";
import LearnClient from "@/app/components/LearnClient"; // Import component con
import NotFoundLesson from "@/app/components/NotFoundLesson";
import matter from "gray-matter";
import LessonContent from "@/app/components/LessonContent";

export interface lessonBasic {
  id: number;
  title: string;
  slug: string;
  has_video: boolean;
  has_exercise: boolean;
}

export type NextLesson = lessonBasic | null;
export type PrevLesson = lessonBasic | null;

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

  // 1. Gate on the server before any lesson content is read.
  const access = await requireCourseAccess(course);
  if ("redirect" in access) redirect(access.redirect);
  if ("notFound" in access) return <NotFoundLesson />;

  // 2. Public metadata only; the lesson must belong to the course in the URL.
  const supabase = await createSupabaseServerClient();
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("id, title, slug, course_id, chapter_id, order_index, created_at")
    .eq("slug", slug)
    .eq("course_id", access.course.id)
    .maybeSingle();

  if (error || !lesson) {
    return <NotFoundLesson />;
  }

  // 3. Private columns, read with the service role only after the gate.
  const { data: privateData } = await supabaseAdmin
    .from("lessons")
    .select("content, video_url")
    .eq("id", lesson.id)
    .single();

  // 4. Logic bài trước/sau
  const chapters = await getLessonsByCourse(course, supabase);
  const allLessons = chapters.flatMap((chapter) => chapter.lessons);
  const currentIndex = allLessons?.findIndex((i) => i.slug === slug) ?? -1;
  const prevLesson = currentIndex > 0 ? allLessons![currentIndex - 1] : null;
  const nextLesson =
    allLessons && currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : null;

  // 5. Xử lý content
  const { content: cleanContent } = matter(privateData?.content || "");
  const videoId = getYouTubeId(privateData?.video_url ?? null);

  return (
    <LearnClient
      lesson={lesson}
      chapters={chapters}
      course={course}
      slug={slug}
      nextLesson={nextLesson}
      prevLesson={prevLesson}
      videoId={videoId}
      isAdmin={access.isAdmin}
    >
      <LessonContent content={cleanContent} />
    </LearnClient>
  );
}
