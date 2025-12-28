import { getLessonsByCourse, supabase, getExerciseByLessonId } from "@/lib/supabase";
import NotFoundLesson from "@/app/components/NotFoundLesson";
import Quiz, { QuizQuestion } from "@/app/components/Quiz";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface Props {
  params: Promise<{ course: string; slug: string }>;
}

export default async function QuizPage({ params }: Props) {
  const { course, slug } = await params;

  // 1. Lấy thông tin bài học
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("id, title, slug")
    .eq("slug", slug)
    .single();

  if (error || !lesson) {
    return <NotFoundLesson />;
  }

  // 2. Lấy user
  const { data: { user } } = await supabase.auth.getUser();

  // 3. Lấy bài tập
  const exercisesRaw = await getExerciseByLessonId(lesson.id);
  
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

  const quizQuestions: QuizQuestion[] = exercisesRaw.map((ex: any) => ({
    id: ex.id,
    question: ex.question,
    options: [ex.option_a, ex.option_b, ex.option_c, ex.option_d],
    correctAnswer: ex.correct_answer,
  }));

  // 4. Logic bài tiếp theo
  const chapters = await getLessonsByCourse(course);
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
          userId={user?.id}
          nextLessonPath={nextLessonPath} 
        />
      </div>
    </div>
  );
}