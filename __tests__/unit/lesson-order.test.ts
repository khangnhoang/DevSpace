import { describe, expect, it } from "vitest";
import { pickContinueLessonSlug, type OrderableLesson } from "@/lib/lesson-order";

// The sort and pick of `getLastAccessedLessonSlug` before they moved into the shared helper, kept verbatim as the
// oracle: the profile page and the course page must send the learner to the same lesson as before.
function previousPick(rawLessons: OrderableLesson[], completed: Set<number>): string | null {
  if (rawLessons.length === 0) return null;
  const chapterOrder = (lesson: OrderableLesson) => {
    const chapter = Array.isArray(lesson.chapters) ? lesson.chapters[0] : lesson.chapters;
    return chapter?.order_index ?? null;
  };
  const all = [...rawLessons].sort((a, b) => {
    const chapA = chapterOrder(a);
    const chapB = chapterOrder(b);
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
  const next = all.find((lesson) => !completed.has(lesson.id));
  return next ? next.slug : all[all.length - 1].slug;
}

const lesson = (
  id: number,
  chapter: number | null,
  order: number | null,
  created = "2026-01-01T00:00:00Z",
  asArray = false,
): OrderableLesson => ({
  id,
  slug: `l${id}`,
  order_index: order,
  created_at: created,
  chapters: chapter === null ? null : asArray ? [{ order_index: chapter }] : { order_index: chapter },
});

describe("pickContinueLessonSlug", () => {
  // Listed out of order so the sort, not the input order, decides.
  const lessons = [lesson(4, 2, 1), lesson(2, 1, 2), lesson(1, 1, 1), lesson(3, 2, 2)];

  it("opens the first lesson of the first chapter when nothing is done", () => {
    expect(pickContinueLessonSlug(lessons, new Set())).toBe("l1");
  });

  it("opens the next unfinished lesson in chapter then lesson order", () => {
    expect(pickContinueLessonSlug(lessons, new Set([1]))).toBe("l2");
    expect(pickContinueLessonSlug(lessons, new Set([1, 2]))).toBe("l4");
  });

  it("skips to the first unfinished lesson when an earlier one is still open", () => {
    expect(pickContinueLessonSlug(lessons, new Set([2, 4]))).toBe("l1");
  });

  it("opens the last lesson when every lesson is done", () => {
    expect(pickContinueLessonSlug(lessons, new Set([1, 2, 3, 4]))).toBe("l3");
  });

  it("returns null for a course with no lesson", () => {
    expect(pickContinueLessonSlug([], new Set())).toBeNull();
  });

  it("puts lessons with a null chapter or lesson order last, then falls back to the creation date", () => {
    const mixed = [
      lesson(1, null, 1),
      lesson(2, 1, null, "2026-02-01T00:00:00Z"),
      lesson(3, 1, null, "2026-01-01T00:00:00Z"),
      lesson(4, 1, 5),
    ];
    expect(pickContinueLessonSlug(mixed, new Set())).toBe("l4");
    expect(pickContinueLessonSlug(mixed, new Set([4]))).toBe("l3");
    expect(pickContinueLessonSlug(mixed, new Set([4, 3]))).toBe("l2");
    expect(pickContinueLessonSlug(mixed, new Set([4, 3, 2]))).toBe("l1");
  });

  it("reads a chapter returned as an array like one returned as an object", () => {
    const asArray = [lesson(2, 2, 1, undefined, true), lesson(1, 1, 1, undefined, true)];
    expect(pickContinueLessonSlug(asArray, new Set())).toBe("l1");
  });

  it("gives the same slug as the previous implementation for started, completed, empty and null-order courses", () => {
    const cases: [string, OrderableLesson[], number[]][] = [
      ["started", lessons, [1, 3]],
      ["completed", lessons, [1, 2, 3, 4]],
      ["no lessons", [], []],
      ["null chapter and lesson orders", [lesson(1, null, null), lesson(2, null, null, "2025-12-01T00:00:00Z"), lesson(3, 1, null)], [3]],
      ["array chapters", [lesson(1, 2, 1, undefined, true), lesson(2, 1, 1, undefined, true)], []],
    ];
    for (const [name, input, done] of cases) {
      expect(pickContinueLessonSlug(input, new Set(done)), name).toBe(previousPick(input, new Set(done)));
    }
  });
});
