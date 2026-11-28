// app/learn/[course]/[slug]/page.tsx
import { redirect } from "next/navigation";
import { getLesson } from "@/lib/learn.server";
import { learnOutcome } from "@/lib/learn-api";
import type { Chapter, Lessons } from "@/lib/supabase";
import LearnClient from "@/app/components/LearnClient"; // Import component con
import NotFoundLesson from "@/app/components/NotFoundLesson";
import LessonUnavailable from "@/app/components/LessonUnavailable";
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

  // 1. One call: the API decides access, then returns the lesson, its private columns and the outline, so no lesson
  // column is read before the verdict and the page makes no Supabase read of its own (TM-U5).
  const read = await getLesson(course, slug);
  const outcome = learnOutcome(read, course);
  if (outcome) {
    if ("redirect" in outcome) redirect(outcome.redirect);
    if ("notFound" in outcome) return <NotFoundLesson />;
    return <LessonUnavailable />;
  }
  if (read.status !== "ok") return <LessonUnavailable />;
  const { lesson: lessonRow, content, video_url, isAdmin } = read.data;
  const lesson = lessonRow as unknown as Lessons;
  const chapters = read.data.chapters as unknown as Chapter[];

  // 2. Logic bài trước/sau
  const allLessons = read.data.chapters.flatMap((chapter) => chapter.lessons);
  const currentIndex = allLessons.findIndex((i) => i.slug === slug);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  // 5. Xử lý content
  const { content: cleanContent } = matter(content || "");
  const videoId = getYouTubeId(video_url);

  return (
    <LearnClient
      lesson={lesson}
      chapters={chapters}
      course={course}
      slug={slug}
      nextLesson={nextLesson}
      prevLesson={prevLesson}
      videoId={videoId}
      isAdmin={isAdmin}
    >
      <LessonContent content={cleanContent} />
    </LearnClient>
  );
}
