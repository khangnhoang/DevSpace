import { describe, expect, it } from "vitest";
import type { DashboardLesson } from "@/lib/profile-courses";
import {
  COURSES_COLLAPSED_COUNT,
  buildDashboardCourses,
  courseActionLabel,
  courseGroupOf,
  orderCoursesByProgress,
  visibleCourses,
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

describe("orderCoursesByProgress", () => {
  it("puts in progress first, then not started, then completed, keeping the input order inside a group", () => {
    const input = [
      course(1, 2, 2), // completed
      course(2, 0, 3), // not started
      course(3, 1, 3), // in progress
      course(4, 3, 3), // completed
      course(5, 0, 2), // not started
      course(6, 2, 5), // in progress
    ];
    expect(orderCoursesByProgress(input).map((c) => c.id)).toEqual([3, 6, 2, 5, 1, 4]);
  });

  it("does not change its input", () => {
    const input = [course(1, 2, 2), course(2, 0, 3)];
    orderCoursesByProgress(input);
    expect(input.map((c) => c.id)).toEqual([1, 2]);
  });
});

describe("visibleCourses", () => {
  const five = [1, 2, 3, 4, 5];

  it("shows the first four when collapsed", () => {
    expect(COURSES_COLLAPSED_COUNT).toBe(4);
    expect(visibleCourses(five, false)).toEqual([1, 2, 3, 4]);
  });

  it("shows every course when expanded", () => {
    expect(visibleCourses(five, true)).toEqual(five);
  });

  it("shows all of four or fewer courses either way", () => {
    expect(visibleCourses([1, 2, 3, 4], false)).toEqual([1, 2, 3, 4]);
    expect(visibleCourses([], false)).toEqual([]);
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

describe("buildDashboardCourses", () => {
  const courses = [
    { id: 1, name: "Free", slug: "free" },
    { id: 2, name: "Paid", slug: "paid" },
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
  const build = (done: number[], enrolled: number[]) =>
    buildDashboardCourses(courses, lessons, new Set(done), new Set(enrolled));

  it("lists an enrolled course with nothing done at 0% and links to its first lesson", () => {
    const [card] = build([], [1]);
    expect(card).toMatchObject({ id: 1, completed: 0, total: 2, percent: 0, isEnrolled: true, href: "/learn/free/l1" });
  });

  it("still lists a started course the learner is not enrolled in", () => {
    const cards = build([5], []);
    expect(cards.map((c) => c.id)).toEqual([4]);
    expect(cards[0]).toMatchObject({ isEnrolled: false, isStarted: true, percent: 100 });
  });

  it("lists a course once when it is both enrolled and started", () => {
    const cards = build([1, 3], [1, 2]);
    expect(cards.map((c) => c.id)).toEqual([1, 2]);
  });

  it("hides a course that is neither enrolled nor started", () => {
    expect(build([1], [2]).map((c) => c.id)).toEqual([1, 2]);
    expect(build([], []).map((c) => c.id)).toEqual([]);
  });

  it("links to the next unfinished lesson, the last lesson when done, and the course page when there is no lesson", () => {
    const byId = Object.fromEntries(build([1, 3, 4], [1, 2, 3]).map((c) => [c.id, c.href]));
    expect(byId[1]).toBe("/learn/free/l2");
    expect(byId[2]).toBe("/learn/paid/l4");
    expect(byId[3]).toBe("/course/empty");
  });
});
