type ChapterOrder = { order_index?: number | null };

export interface OrderableLesson {
  id: number;
  slug: string;
  order_index?: number | null;
  created_at: string;
  chapters?: ChapterOrder | ChapterOrder[] | null;
}

type SortableLesson = Pick<OrderableLesson, "order_index" | "created_at" | "chapters">;

// Supabase returns the embedded chapter as an object or an array depending on the relation; handle both.
const chapterOrderOf = (lesson: SortableLesson) => {
  const chapter = Array.isArray(lesson.chapters) ? lesson.chapters[0] : lesson.chapters;
  return chapter?.order_index ?? null;
};

// The one lesson order of the product: chapter order, then lesson order, then creation date, nulls last. The course
// page and the profile page both pick the continue target from it, so they must never keep separate copies.
export function sortLessonsInCourseOrder<T extends SortableLesson>(lessons: readonly T[]): T[] {
  return [...lessons].sort((a, b) => {
    const chapA = chapterOrderOf(a);
    const chapB = chapterOrderOf(b);
    if (chapA !== chapB) {
      if (chapA === null) return 1;
      if (chapB === null) return -1;
      return chapA - chapB;
    }

    const orderA = a.order_index ?? null;
    const orderB = b.order_index ?? null;
    if (orderA !== orderB) {
      if (orderA === null) return 1;
      if (orderB === null) return -1;
      return orderA - orderB;
    }

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

// The first unfinished lesson in course order, the last lesson when every one is done, null when the course has none.
export function pickContinueLessonSlug(
  lessons: readonly OrderableLesson[],
  completedLessonIds: ReadonlySet<number>,
): string | null {
  const ordered = sortLessonsInCourseOrder(lessons);
  if (ordered.length === 0) return null;
  const next = ordered.find((lesson) => !completedLessonIds.has(lesson.id));
  return (next ?? ordered[ordered.length - 1]).slug;
}
