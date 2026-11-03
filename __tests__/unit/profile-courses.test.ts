import { describe, expect, it } from "vitest";
import type { DashboardLesson } from "@/lib/profile-courses";
import {
  buildDashboardCourses,
  courseActionLabel,
  courseGroupOf,
  layoutCourses,
  orderCoursesByActivity,
  pickFeaturedCourse,
} from "@/lib/profile-courses";

const course = (id: number, completed: number, total: number) => ({ id, completed, total });

describe("courseGroupOf", () => {
  it.each([
    ["no lesson done", course(1, 0, 4), "not-started"],
    ["some lessons done", course(1, 1, 4), "in-progress"],
    ["one lesson of 300 (rounds to 0%)", course(1, 1, 300), "in-progress"],
    ["every lesson done", course(1, 4, 4), "completed"],
    ["a course with no lesson", course(1, 0, 0), "not-started"],
  ])("%s", (_name, input, group) => {
    expect(courseGroupOf(input)).toBe(group);
  });
});

describe("courseActionLabel", () => {
  it.each([
    [course(1, 0, 3), "Bắt đầu học"],
    [course(1, 1, 3), "Tiếp tục học"],
    [course(1, 3, 3), "Ôn lại"],
    [course(1, 0, 0), "Xem khóa học"],
  ])("labels %j as %s", (input, label) => {
    expect(courseActionLabel(input)).toBe(label);
  });
});

describe("orderCoursesByActivity", () => {
  const at = (id: number, lastActivityAt: string | null) => ({ id, lastActivityAt });

  it("puts the most recent activity first and a course without activity last", () => {
    const input = [
      at(1, "2026-01-01T00:00:00Z"),
      at(2, null),
      at(3, "2026-03-01T00:00:00Z"),
      at(4, "2026-02-01T00:00:00Z"),
    ];
    expect(orderCoursesByActivity(input).map((c) => c.id)).toEqual([3, 4, 1, 2]);
  });

  it("keeps the input order for equal times and for courses without activity", () => {
    const same = "2026-01-01T00:00:00Z";
    expect(orderCoursesByActivity([at(5, same), at(2, same), at(9, null), at(1, null)]).map((c) => c.id)).toEqual([5, 2, 9, 1]);
  });

  it("does not change its input", () => {
    const input = [at(1, "2026-01-01T00:00:00Z"), at(2, "2026-02-01T00:00:00Z")];
    orderCoursesByActivity(input);
    expect(input.map((c) => c.id)).toEqual([1, 2]);
  });
});

describe("pickFeaturedCourse", () => {
  it("picks the first unfinished course in order, skipping completed ones and courses without lessons", () => {
    const ordered = [course(1, 2, 2), course(2, 0, 0), course(3, 1, 3), course(4, 0, 2)];
    expect(pickFeaturedCourse(ordered)?.id).toBe(3);
  });

  it("counts an enrolled course with nothing done as unfinished", () => {
    expect(pickFeaturedCourse([course(1, 2, 2), course(2, 0, 2)])?.id).toBe(2);
  });

  it("picks none when every course is finished or has no lesson", () => {
    expect(pickFeaturedCourse([course(1, 2, 2), course(2, 0, 0)])).toBeNull();
    expect(pickFeaturedCourse([])).toBeNull();
  });
});

describe("layoutCourses", () => {
  const five = [course(1, 2, 2), course(2, 1, 3), course(3, 0, 2), course(4, 0, 0), course(5, 2, 2)];

  it("shows the featured card and three rows when collapsed, and offers to expand", () => {
    const layout = layoutCourses(five, false);
    expect(layout.featured?.id).toBe(2);
    expect(layout.rows.map((c) => c.id)).toEqual([1, 3, 4]);
    expect(layout.canExpand).toBe(true);
  });

  it("shows four rows when nothing is unfinished", () => {
    const done = [course(1, 2, 2), course(2, 2, 2), course(3, 0, 0), course(4, 1, 1), course(5, 1, 1)];
    const layout = layoutCourses(done, false);
    expect(layout.featured).toBeNull();
    expect(layout.rows.map((c) => c.id)).toEqual([1, 2, 3, 4]);
  });

  it("shows every course when expanded, with the featured one on top and not repeated", () => {
    const layout = layoutCourses(five, true);
    expect(layout.featured?.id).toBe(2);
    expect(layout.rows.map((c) => c.id)).toEqual([1, 3, 4, 5]);
  });

  it("offers no button for four courses or fewer", () => {
    expect(layoutCourses(five.slice(0, 4), false)).toMatchObject({ canExpand: false });
    expect(layoutCourses(five.slice(0, 4), false).rows).toHaveLength(3);
    expect(layoutCourses([], false)).toEqual({ featured: null, rows: [], canExpand: false });
  });
});

describe("buildDashboardCourses", () => {
  const courses = [
    { id: 1, name: "Free", slug: "free", image_url: "https://img.example/free.png" },
    { id: 2, name: "Paid", slug: "paid", image_url: null },
    { id: 3, name: "Empty", slug: "empty" },
    { id: 4, name: "Other", slug: "other" },
  ];
  const lesson = (id: number, course_id: number, order: number): DashboardLesson => ({
    id,
    course_id,
    slug: `l${id}`,
    order_index: order,
    created_at: "2026-01-01T00:00:00Z",
    chapters: { order_index: 1 },
  });
  const lessons = [lesson(1, 1, 1), lesson(2, 1, 2), lesson(3, 2, 1), lesson(4, 2, 2), lesson(5, 4, 1)];
  const done = (...ids: number[]) => ids.map((lesson_id) => ({ lesson_id, completed_at: "2026-02-01T00:00:00Z" }));
  const enrolled = (...ids: number[]) => ids.map((course_id) => ({ course_id, created_at: "2026-01-15T00:00:00Z" }));

  it("lists an enrolled course with nothing done at 0% and links to its first lesson", () => {
    const [card] = buildDashboardCourses(courses, lessons, [], enrolled(1));
    expect(card).toMatchObject({ id: 1, completed: 0, total: 2, percent: 0, isEnrolled: true, href: "/learn/free/l1" });
  });

  it("still lists a started course the learner is not enrolled in", () => {
    const cards = buildDashboardCourses(courses, lessons, done(5), []);
    expect(cards.map((c) => c.id)).toEqual([4]);
    expect(cards[0]).toMatchObject({ isEnrolled: false, isStarted: true, percent: 100 });
  });

  it("lists a course once when it is both enrolled and started", () => {
    const cards = buildDashboardCourses(courses, lessons, done(1, 3), enrolled(1, 2));
    expect(cards.map((c) => c.id).sort()).toEqual([1, 2]);
  });

  it("hides a course that is neither enrolled nor started", () => {
    expect(buildDashboardCourses(courses, lessons, done(1), enrolled(2)).map((c) => c.id).sort()).toEqual([1, 2]);
    expect(buildDashboardCourses(courses, lessons, [], [])).toEqual([]);
  });

  it("links to the next unfinished lesson, the last lesson when done, and the course page when there is no lesson", () => {
    const cards = buildDashboardCourses(courses, lessons, done(1, 3, 4), enrolled(1, 2, 3));
    const byId = Object.fromEntries(cards.map((c) => [c.id, c.href]));
    expect(byId[1]).toBe("/learn/free/l2");
    expect(byId[2]).toBe("/learn/paid/l4");
    expect(byId[3]).toBe("/course/empty");
  });

  it("carries the course image, or null when it has none", () => {
    const cards = buildDashboardCourses(courses, lessons, [], enrolled(1, 2, 3));
    const byId = Object.fromEntries(cards.map((c) => [c.id, c.imageUrl]));
    expect(byId).toEqual({ 1: "https://img.example/free.png", 2: null, 3: null });
  });

  it("orders by the latest completed_at in the course, and by the enrollment date when no lesson is done", () => {
    const progress = [
      { lesson_id: 1, completed_at: "2026-03-01T00:00:00Z" },
      { lesson_id: 2, completed_at: "2026-02-01T00:00:00Z" }, // earlier than lesson 1: the max counts
      { lesson_id: 3, completed_at: "2026-03-10T00:00:00Z" },
    ];
    const enrollments = [
      { course_id: 1, created_at: "2026-04-01T00:00:00Z" }, // enrolled later, but progress wins over the enrollment date
      { course_id: 2, created_at: "2026-01-01T00:00:00Z" },
      { course_id: 4, created_at: "2026-03-05T00:00:00Z" }, // nothing done: its enrollment date orders it
    ];
    const cards = buildDashboardCourses(courses, lessons, progress, enrollments);
    expect(cards.map((c) => [c.id, c.lastActivityAt])).toEqual([
      [2, "2026-03-10T00:00:00Z"],
      [4, "2026-03-05T00:00:00Z"],
      [1, "2026-03-01T00:00:00Z"],
    ]);
  });

  it("keeps the courses query order for equal activity", () => {
    const enrollments = [
      { course_id: 4, created_at: "2026-01-01T00:00:00Z" },
      { course_id: 1, created_at: "2026-01-01T00:00:00Z" },
    ];
    expect(buildDashboardCourses(courses, lessons, [], enrollments).map((c) => c.id)).toEqual([1, 4]);
  });
});
