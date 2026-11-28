import { describe, expect, it } from "vitest";
import { learnLessonQuery, learnOutlineQuery } from "../../lib/schemas/learn";

describe("learn query schemas", () => {
  it("accepts the slugs the /learn URLs carry", () => {
    expect(
      learnLessonQuery.safeParse({
        course: "javascript-can-ban",
        lesson: "bien-va-kieu-du-lieu",
      }).success,
    ).toBe(true);
    expect(learnOutlineQuery.safeParse({ course: "lam quen" }).success).toBe(
      true,
    );
  });

  it("accepts a stored slug of any length, because the admin lesson form sets no limit", () => {
    expect(
      learnLessonQuery.safeParse({
        course: "a".repeat(256),
        lesson: "b".repeat(1000),
      }).success,
    ).toBe(true);
  });

  it("rejects a missing, empty, repeated or NUL-carrying slug", () => {
    for (const input of [
      {},
      { course: "" },
      { course: ["a", "b"] },
      { course: "a\0b" },
    ]) {
      expect(
        learnOutlineQuery.safeParse(input).success,
        JSON.stringify(input),
      ).toBe(false);
    }
    expect(learnLessonQuery.safeParse({ course: "a" }).success).toBe(false);
    expect(
      learnLessonQuery.safeParse({ course: "a", lesson: "" }).success,
    ).toBe(false);
  });

  it("strips keys the routes do not take", () => {
    expect(
      learnOutlineQuery.parse({ course: "a", courseId: "2", userId: "x" }),
    ).toEqual({ course: "a" });
  });
});
