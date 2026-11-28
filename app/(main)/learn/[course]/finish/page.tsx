import { redirect } from "next/navigation";
import NotFoundLesson from "@/app/components/NotFoundLesson";
import LessonUnavailable from "@/app/components/LessonUnavailable";
import { requireCourseAccess } from "@/lib/auth.server";
import FinishCompletion from "./_components/FinishCompletion";

// Gated like a lesson (TM-U5 AC11): a visitor goes to /login, a learner who is not enrolled to the course page, and an
// unknown course shows the not-found lesson screen.
export default async function FinishCoursePage({
  params,
}: {
  params: Promise<{ course: string }>;
}) {
  const { course } = await params;
  const access = await requireCourseAccess(course);
  if ("redirect" in access) redirect(access.redirect);
  if ("notFound" in access) return <NotFoundLesson />;
  if ("unavailable" in access) return <LessonUnavailable />;
  return <FinishCompletion course={course} />;
}
