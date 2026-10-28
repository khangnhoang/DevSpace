import { describe, expect, it } from "vitest";
import { isCorrectAnswer } from "@/lib/quiz-answer";

describe("isCorrectAnswer", () => {
  it("accepts the selected option when the stored answer matches", () => {
    expect(isCorrectAnswer("b", "b")).toBe(true);
  });

  // BL-010: a stored answer in another case or with spacing still accepts the right option.
  it.each([
    ["an uppercase answer", "B"],
    ["an answer with spacing", " b "],
  ])("accepts the selected option when the stored answer is %s", (_, stored) => {
    expect(isCorrectAnswer("b", stored)).toBe(true);
  });

  it.each(["a", "A", "c"])("rejects option %s when the stored answer is b", (selected) => {
    expect(isCorrectAnswer(selected, "B")).toBe(false);
  });
});
