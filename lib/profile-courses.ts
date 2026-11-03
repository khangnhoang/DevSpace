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

// The label of the link on a card: it names what the learner does next.
export function courseActionLabel(course: Pick<DashboardCourse, "total" | "completed">): string {
  if (course.total === 0) return "Xem khóa học";
  const group = courseGroupOf(course);
  if (group === "completed") return "Ôn lại";
  if (group === "in-progress") return "Tiếp tục học";
  return "Bắt đầu học";
}

const activityTime = (course: Pick<DashboardCourse, "lastActivityAt">) =>
  course.lastActivityAt ? new Date(course.lastActivityAt).getTime() : Number.NEGATIVE_INFINITY;

// Most recent activity first; a course with no recorded activity goes last. The sort is stable, so ties keep the input
// order, which is the order the courses query returned.
export function orderCoursesByActivity<T extends Pick<DashboardCourse, "lastActivityAt">>(courses: readonly T[]): T[] {
  return [...courses].sort((a, b) => {
    const timeA = activityTime(a);
    const timeB = activityTime(b);
    if (timeA === timeB) return 0;
    return timeB > timeA ? 1 : -1;
  });
}

// The course the learner is on: the first unfinished one (it has lessons and not all are done) of a list already ordered by activity.
export function pickFeaturedCourse<T extends Pick<DashboardCourse, "total" | "completed">>(ordered: readonly T[]): T | null {
  return ordered.find((course) => course.total > 0 && course.completed < course.total) ?? null;
}

// The featured course on top, then the other courses in order. Collapsed, four courses show in all (the featured card
// counts as one); expanded, every course shows. The button appears only when more than the limit exist.
export function layoutCourses<T extends Pick<DashboardCourse, "total" | "completed">>(
  ordered: readonly T[],
  expanded: boolean,
  limit = COURSES_COLLAPSED_COUNT,
): { featured: T | null; rows: T[]; canExpand: boolean } {
  const featured = pickFeaturedCourse(ordered);
  const others = ordered.filter((course) => course !== featured);
  const room = featured ? limit - 1 : limit;
  return {
    featured,
    rows: expanded ? others : others.slice(0, room),
    canExpand: ordered.length > limit,
  };
}

export type DashboardLesson = OrderableLesson & { course_id: number };
export type DashboardProgress = { lesson_id: number; completed_at?: string | null };
export type DashboardEnrollment = { course_id: number; created_at?: string | null };

const latest = (a: string | null, b: string | null | undefined) =>
  b && (!a || new Date(b).getTime() > new Date(a).getTime()) ? b : a;

// One card per course, ordered by latest activity. A course shows when the learner is enrolled or has completed a
// lesson: a started free course may have no enrollment row, and an enrolled course with nothing done shows at 0%.
export function buildDashboardCourses(
  courses: readonly (Pick<DBCourse, "id" | "name" | "slug"> & { image_url?: string | null })[],
  lessons: readonly DashboardLesson[],
  progress: readonly DashboardProgress[],
  enrollments: readonly DashboardEnrollment[],
): DashboardCourse[] {
  const completedLessonIds = new Set(progress.map((p) => p.lesson_id));
  const completedAtOfLesson = new Map(progress.map((p) => [p.lesson_id, p.completed_at ?? null]));
  const enrolledAtOfCourse = new Map<number, string | null>();
  for (const e of enrollments) enrolledAtOfCourse.set(e.course_id, latest(enrolledAtOfCourse.get(e.course_id) ?? null, e.created_at));

  const cards = courses
    .map((course) => {
      const lessonsOfCourse = lessons.filter((l) => l.course_id === course.id);
      const total = lessonsOfCourse.length;
      const done = lessonsOfCourse.filter((l) => completedLessonIds.has(l.id));
      // The same target as the course page's "Tiếp tục học ngay"; a course without lessons falls back to its page.
      const continueSlug = pickContinueLessonSlug(lessonsOfCourse, completedLessonIds);
      const lastCompletedAt = done.reduce<string | null>((acc, l) => latest(acc, completedAtOfLesson.get(l.id)), null);

      return {
        id: course.id,
        title: course.name,
        slug: course.slug,
        total,
        completed: done.length,
        percent: total > 0 ? Math.round((done.length / total) * 100) : 0,
        isStarted: done.length > 0,
        isEnrolled: enrolledAtOfCourse.has(course.id),
        imageUrl: course.image_url || null,
        lastActivityAt: lastCompletedAt ?? enrolledAtOfCourse.get(course.id) ?? null,
        href: continueSlug ? `/learn/${course.slug}/${continueSlug}` : `/course/${course.slug}`,
      };
    })
    .filter((course) => course.isEnrolled || course.isStarted);

  return orderCoursesByActivity(cards);
}
