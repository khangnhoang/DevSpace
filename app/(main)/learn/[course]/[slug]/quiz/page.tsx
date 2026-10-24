import { redirect } from "next/navigation";
import { getLessonsByCourse } from "@/lib/supabase";
import { requireCourseAccess } from "@/lib/auth.server";
import { createSupabaseServerClient } from "@/lib/supabase.server";
import NotFoundLesson from "@/app/components/NotFoundLesson";
import Quiz, { QuizQuestion } from "@/app/components/Quiz";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { DBExercise } from "@/lib/types";

interface Props {
  params: Promise<{ course: string; slug: string }>;
}

export default async function QuizPage({ params }: Props) {
  const { course, slug } = await params;

  // 1. Gate on the server: signed in and enrolled (or admin)
  const access = await requireCourseAccess(course);
  if ("redirect" in access) redirect(access.redirect);
  if ("notFound" in access) return <NotFoundLesson />;

  // 2. Lấy thông tin bài học (phải thuộc khóa học trên URL)
  const supabase = await createSupabaseServerClient();
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("id, title, slug")
    .eq("slug", slug)
    .eq("course_id", access.course.id)
    .maybeSingle();

  if (error || !lesson) {
    return <NotFoundLesson />;
  }

  const user = access.user;

  // 3. Lấy bài tập (RLS cho phép vì đã enroll / admin)
  const { data: exercisesRaw } = await supabase
    .from("exercises")
    .select("*")
    .eq("lesson_id", lesson.id)
    .order("id", { ascending: true });

  if (!exercisesRaw || exercisesRaw.length === 0) {
    return (
      <div className="p-8 min-h-screen w-full bg-gray-50 pt-16 flex flex-col items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Chưa có bài tập</h2>
          <p className="text-gray-500 mb-6">Bài học này hiện chưa cập nhật bài tập thực hành.</p>
          <Link 
            href={`/learn/${course}/${slug}`}
            className="text-blue-600 hover:underline flex items-center justify-center gap-2"
          >
            <ChevronLeft size={16} /> Quay lại bài học
          </Link>
        </div>
      </div>
    );
  }

  const quizQuestions: QuizQuestion[] = exercisesRaw.map((ex: DBExercise) => ({
    id: ex.id,
    question: ex.question,
    options: [ex.option_a, ex.option_b, ex.option_c, ex.option_d],
    correctAnswer: ex.correct_answer,
  }));

  // 4. Logic bài tiếp theo
  const chapters = await getLessonsByCourse(course, supabase);
  const allLessons = chapters.flatMap((chapter) => chapter.lessons);
  const currentIndex = allLessons?.findIndex((i) => i.slug === slug) ?? -1;
  const nextLesson =
    allLessons && currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : null;
  const nextLessonPath = nextLesson ? `/learn/${course}/${nextLesson.slug}` : null;

  return (
    <div className="md:p-8 min-h-screen p-4 w-full bg-gray-50 lg:w-3/4 mx-auto pt-16">
      {/* Breadcrumb / Back Link */}
      <div className="mb-6">
        <Link 
          href={`/learn/${course}/${slug}`} 
          className="inline-flex items-center text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ChevronLeft size={16} className="mr-1" />
          Quay lại bài học: <span className="font-bold ml-1">{lesson.title}</span>
        </Link>
      </div>

      <div className="bg-white p-4 md:p-10 rounded-xl shadow-sm border border-gray-200 min-h-[60vh]">
        <div className="mb-8 border-b pb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Bài tập thực hành
          </h1>
          <p className="text-gray-500 mt-2">
            Hoàn thành các câu hỏi dưới đây để củng cố kiến thức bài học.
          </p>
        </div>

        {/* Component Quiz tái sử dụng */}
        <Quiz 
          questions={quizQuestions} 
          lessonId={lesson.id} 
          userId={user.id}
          nextLessonPath={nextLessonPath} 
        />
      </div>
    </div>
  );
}