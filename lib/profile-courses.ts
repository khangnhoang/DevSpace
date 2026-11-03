import { pickContinueLessonSlug, type OrderableLesson } from "@/lib/lesson-order";
import type { DBCourse, DashboardCourse } from "@/lib/types";

export const COURSES_COLLAPSED_COUNT = 4;

export type CourseProgressGroup = "in-progress" | "not-started" | "completed";

// Counts decide the group, not the rounded percent: 1 of 300 lessons shows 0% but is in progress.
export function courseGroupOf(course: Pick<DashboardCourse, "total" | "completed">): CourseProgressGroup {
  if (course.total > 0 && course.completed >= course.total) return "completed";
  if (course.completed > 0) return "in-progress";
  return "not-started";
}

const GROUP_RANK: Record<CourseProgressGroup, number> = {
  "in-progress": 0,
  "not-started": 1,
  completed: 2,
};

// In progress first, then not started, then completed; the sort is stable, so the courses query order holds within a group.
export function orderCoursesByProgress<T extends Pick<DashboardCourse, "total" | "completed">>(courses: readonly T[]): T[] {
  return [...courses].sort((a, b) => GROUP_RANK[courseGroupOf(a)] - GROUP_RANK[courseGroupOf(b)]);
}

export function visibleCourses<T>(courses: readonly T[], expanded: boolean, limit = COURSES_COLLAPSED_COUNT): T[] {
  return expanded ? [...courses] : courses.slice(0, limit);
}

// The label of the link on a card: it names what the learner does next.
export function courseActionLabel(course: Pick<DashboardCourse, "total" | "completed">): string {
  if (course.total === 0) return "Xem khóa học";
  const group = courseGroupOf(course);
  if (group === "completed") return "Ôn lại";
  if (group === "in-progress") return "Tiếp tục học";
  return "Bắt đầu học";
}

export type DashboardLesson = OrderableLesson & { course_id: number };

// One card per course. A course shows when the learner is enrolled or has completed a lesson: a started free course may
// have no enrollment row, and an enrolled course with nothing done shows at 0%.
export function buildDashboardCourses(
  courses: readonly Pick<DBCourse, "id" | "name" | "slug">[],
  lessons: readonly DashboardLesson[],
  completedLessonIds: ReadonlySet<number>,
  enrolledCourseIds: ReadonlySet<number>,
): DashboardCourse[] {
  return courses
    .map((course) => {
      const lessonsOfCourse = lessons.filter((l) => l.course_id === course.id);
      const total = lessonsOfCourse.length;
      const completed = lessonsOfCourse.filter((l) => completedLessonIds.has(l.id)).length;
      // The same target as the course page's "Tiếp tục học ngay"; a course without lessons falls back to its page.
      const continueSlug = pickContinueLessonSlug(lessonsOfCourse, completedLessonIds);

      return {
        id: course.id,
        title: course.name,
        slug: course.slug,
        total,
        completed,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
        isStarted: completed > 0,
        isEnrolled: enrolledCourseIds.has(course.id),
        href: continueSlug ? `/learn/${course.slug}/${continueSlug}` : `/course/${course.slug}`,
      };
    })
    .filter((course) => course.isEnrolled || course.isStarted);
}
