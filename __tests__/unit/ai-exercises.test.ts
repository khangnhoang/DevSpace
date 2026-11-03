import { describe, expect, it, vi } from "vitest";
import {
  AI_INVALID_MESSAGE,
  bulkCreateAiExercises,
  checkAiExercises,
  describeAiBulk,
  firstAiExerciseToForm,
  saveAiExercises,
} from "@/app/admin/lessons/_lib/ai-exercises";

const question = (n: number, overrides: Record<string, unknown> = {}) => ({
  question: `Câu hỏi ${n}?`,
  option_a: "A",
  option_b: "B",
  option_c: "C",
  option_d: "D",
  correct_answer: "b",
  explanation: `Giải thích ${n}`,
  ...overrides,
});
const three = [question(1), question(2), question(3)];

describe("checkAiExercises", () => {
  it("accepts a list of valid questions and returns the parsed values", () => {
    const items = checkAiExercises([
      question(1, {
        question: "  Câu 1?  ",
        correct_answer: " B ",
        explanation: "",
      }),
    ]);
    expect(items).toEqual([
      {
        ...question(1),
        question: "Câu 1?",
        correct_answer: "b",
        explanation: null,
      },
    ]);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "[]"],
    ["an object", { question: "x" }],
    ["an empty list", []],
  ])("refuses %s", (_name, data) => {
    expect(checkAiExercises(data)).toBeNull();
  });

  it("refuses the whole set when one question is invalid", () => {
    expect(
      checkAiExercises([
        question(1),
        question(2, { option_c: "  " }),
        question(3),
      ]),
    ).toBeNull();
    expect(
      checkAiExercises([question(1), question(2, { correct_answer: "e" })]),
    ).toBeNull();
    expect(checkAiExercises([question(1), null])).toBeNull();
    expect(
      checkAiExercises([question(1), { question: "only a question" }]),
    ).toBeNull();
  });
});

describe("saveAiExercises", () => {
  it("saves every question for the lesson and reports the count when all succeed (AC8)", async () => {
    const addExercise = vi.fn<
      (lessonId: number, item: { question: string }) => Promise<{ error: null }>
    >(async () => ({ error: null }));
    const outcome = await saveAiExercises(
      7,
      checkAiExercises(three)!,
      addExercise,
    );
    expect(outcome).toEqual({ kind: "saved", count: 3 });
    expect(addExercise).toHaveBeenCalledTimes(3);
    expect(addExercise.mock.calls.map(([lessonId]) => lessonId)).toEqual([
      7, 7, 7,
    ]);
  });

  it("waits for the saves before it returns", async () => {
    let finished = 0;
    const addExercise = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      finished += 1;
      return { error: null };
    };
    await saveAiExercises(1, checkAiExercises(three)!, addExercise);
    expect(finished).toBe(3);
  });

  it("reports how many were saved when one save returns an error", async () => {
    const addExercise = vi.fn(
      async (_id: number, item: { question: string }) => ({
        error: item.question === "Câu hỏi 2?" ? { message: "boom" } : null,
      }),
    );
    expect(
      await saveAiExercises(1, checkAiExercises(three)!, addExercise),
    ).toEqual({ kind: "partial", saved: 2, total: 3 });
  });

  it("counts a thrown save as not saved and still waits for the others", async () => {
    const addExercise = vi.fn(
      async (_id: number, item: { question: string }) => {
        if (item.question === "Câu hỏi 1?") throw new Error("network");
        return { error: null };
      },
    );
    expect(
      await saveAiExercises(1, checkAiExercises(three)!, addExercise),
    ).toEqual({ kind: "partial", saved: 2, total: 3 });
    expect(addExercise).toHaveBeenCalledTimes(3);
  });

  it("reports 0 of 3 when every save fails", async () => {
    const addExercise = vi.fn(async () => ({ error: { message: "x" } }));
    expect(
      await saveAiExercises(1, checkAiExercises(three)!, addExercise),
    ).toEqual({ kind: "partial", saved: 0, total: 3 });
  });
});

describe("bulkCreateAiExercises", () => {
  it("saves nothing when the result is invalid (AC8)", async () => {
    const addExercise = vi.fn(async () => ({ error: null }));
    expect(
      await bulkCreateAiExercises(
        1,
        [question(1), question(2, { question: "" })],
        addExercise,
      ),
    ).toEqual({ kind: "invalid" });
    expect(await bulkCreateAiExercises(1, undefined, addExercise)).toEqual({
      kind: "invalid",
    });
    expect(await bulkCreateAiExercises(1, [], addExercise)).toEqual({
      kind: "invalid",
    });
    expect(addExercise).not.toHaveBeenCalled();
  });

  it("saves a valid set", async () => {
    const addExercise = vi.fn(async () => ({ error: null }));
    expect(await bulkCreateAiExercises(1, three, addExercise)).toEqual({
      kind: "saved",
      count: 3,
    });
  });
});

describe("describeAiBulk", () => {
  it("says the AI result was invalid", () => {
    expect(describeAiBulk({ kind: "invalid" })).toEqual({
      ok: false,
      message: `${AI_INVALID_MESSAGE}, chưa lưu câu hỏi nào`,
    });
    expect(AI_INVALID_MESSAGE).toContain("không hợp lệ");
  });

  it("toasts the success text with the number saved only when all succeeded", () => {
    expect(describeAiBulk({ kind: "saved", count: 3 })).toEqual({
      ok: true,
      message: "Đã thêm thành công 3 câu hỏi!",
    });
    expect(describeAiBulk({ kind: "saved", count: 1 }).message).toBe(
      "Đã thêm thành công 1 câu hỏi!",
    );
  });

  it("names how many were saved when some failed, never the success text", () => {
    const partial = describeAiBulk({ kind: "partial", saved: 2, total: 3 });
    expect(partial.ok).toBe(false);
    expect(partial.message).toContain("2/3");
    expect(partial.message).not.toContain("Đã thêm thành công");
  });
});

describe("firstAiExerciseToForm", () => {
  it("fills the form from the first question and lowercases the answer", () => {
    expect(
      firstAiExerciseToForm([
        question(1, { correct_answer: "C" }),
        question(2),
      ]),
    ).toEqual({ ...question(1), correct_answer: "c" });
  });

  it("leaves a missing or non-text field blank", () => {
    expect(
      firstAiExerciseToForm([{ question: "Chỉ có câu hỏi", option_a: 5 }]),
    ).toEqual({
      question: "Chỉ có câu hỏi",
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      correct_answer: "",
      explanation: "",
    });
  });

  it.each([undefined, null, [], "text", [null], ["text"]])(
    "returns null for %j",
    (data) => {
      expect(firstAiExerciseToForm(data)).toBeNull();
    },
  );
});
