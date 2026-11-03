import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHAPTER_COURSE_MESSAGE,
  CHAPTER_ORDER_MESSAGE,
  CHAPTER_TITLE_MESSAGE,
  COURSE_NAME_MESSAGE,
  COURSE_PRICE_MESSAGE,
  COURSE_SLUG_MESSAGE,
  EXERCISE_ANSWER_MESSAGE,
  EXERCISE_QUESTION_MESSAGE,
  LESSON_CHAPTER_MESSAGE,
  LESSON_COURSE_MESSAGE,
  LESSON_ORDER_MESSAGE,
  LESSON_SLUG_MESSAGE,
  LESSON_TITLE_MESSAGE,
  chapterSchema,
  courseSchema,
  exerciseSchema,
  exerciseOptionMessage,
  lessonSchema,
} from "@/lib/schemas/admin-content-forms";

function messagesOf(result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  if (result.success)
    throw new Error("expected the schema to refuse the value");
  return result.error!.issues.map((issue) => issue.message);
}

const course = {
  name: "Lập trình ReactJS",
  slug: "lap-trinh-reactjs",
  description: "",
  price: "",
  instructor_id: "",
};

describe("courseSchema", () => {
  it("accepts a course with a name, a slug and a price and no description or instructor (AC1)", () => {
    expect(
      courseSchema.parse({
        ...course,
        name: "  Lập trình ReactJS ",
        slug: " lap-trinh-reactjs ",
        price: "199000",
      }),
    ).toEqual({
      name: "Lập trình ReactJS",
      slug: "lap-trinh-reactjs",
      description: null,
      price: 199000,
      instructor_id: null,
    });
  });

  it("keeps a filled description trimmed and an instructor as a number", () => {
    const parsed = courseSchema.parse({
      ...course,
      description: "  Học React từ đầu  ",
      instructor_id: "3",
    });
    expect(parsed.description).toBe("Học React từ đầu");
    expect(parsed.instructor_id).toBe(3);
  });

  it("saves a blank price as 0 and keeps a price of 0 as 0 (AC2, AC9)", () => {
    expect(courseSchema.parse({ ...course, price: "" }).price).toBe(0);
    expect(courseSchema.parse({ ...course, price: "   " }).price).toBe(0);
    expect(courseSchema.parse({ ...course, price: "0" }).price).toBe(0);
  });

  it("accepts any slug text, including capitals, spaces and symbols (no slug format rule, BL-P12)", () => {
    for (const slug of ["Khóa Học 1", "a_b", "x".repeat(300), "UPPER-case"]) {
      expect(courseSchema.parse({ ...course, slug }).slug).toBe(slug);
    }
  });

  it("refuses a blank name and a blank slug with a message for each field", () => {
    const issues = courseSchema.safeParse({ ...course, name: "  ", slug: "" });
    expect(messagesOf(issues)).toEqual([
      COURSE_NAME_MESSAGE,
      COURSE_SLUG_MESSAGE,
    ]);
  });

  it.each(["-1", "-1000", "1.5", "0.5", "abc", "1e400", "Infinity", "NaN"])(
    "refuses the price %s",
    (price) => {
      expect(messagesOf(courseSchema.safeParse({ ...course, price }))).toEqual([
        COURSE_PRICE_MESSAGE,
      ]);
    },
  );

  it("accepts a whole price written as a decimal or in exponent form", () => {
    expect(courseSchema.parse({ ...course, price: "1000.0" }).price).toBe(1000);
    expect(courseSchema.parse({ ...course, price: "2e3" }).price).toBe(2000);
  });

  it("refuses an instructor value that is not a row id", () => {
    expect(
      courseSchema.safeParse({ ...course, instructor_id: "abc" }).success,
    ).toBe(false);
    expect(
      courseSchema.safeParse({ ...course, instructor_id: "0" }).success,
    ).toBe(false);
  });
});

describe("chapterSchema", () => {
  const chapter = { title: "Chương 1", order_index: "1", course_id: "2" };

  it("accepts a title, an order and a course and returns numbers (AC3)", () => {
    expect(chapterSchema.parse({ ...chapter, title: "  Chương 1  " })).toEqual({
      title: "Chương 1",
      order_index: 1,
      course_id: 2,
    });
  });

  it.each(["0", "-3", "99", " 5 "])(
    "accepts the order %s (negative and 0 included)",
    (order_index) => {
      expect(chapterSchema.parse({ ...chapter, order_index }).order_index).toBe(
        Number(order_index),
      );
    },
  );

  it("refuses a blank title, a blank order and no course, one message per field", () => {
    expect(
      messagesOf(
        chapterSchema.safeParse({ title: " ", order_index: "", course_id: "" }),
      ),
    ).toEqual([
      CHAPTER_TITLE_MESSAGE,
      CHAPTER_ORDER_MESSAGE,
      CHAPTER_COURSE_MESSAGE,
    ]);
  });

  it.each(["1.5", "abc", "Infinity"])("refuses the order %s", (order_index) => {
    expect(
      messagesOf(chapterSchema.safeParse({ ...chapter, order_index })),
    ).toEqual([CHAPTER_ORDER_MESSAGE]);
  });
});

describe("lessonSchema", () => {
  const lesson = {
    title: "Biến",
    slug: "bien",
    course_id: "1",
    chapter_id: "4",
    video_url: "",
    order_index: "",
    content: "",
  };

  it("accepts a lesson with an empty body, a blank video URL and a blank order (AC4)", () => {
    expect(lessonSchema.parse(lesson)).toEqual({
      title: "Biến",
      slug: "bien",
      course_id: 1,
      chapter_id: 4,
      video_url: null,
      order_index: null,
      content: "",
    });
  });

  it("passes the content exactly as typed, whitespace and trailing newlines included", () => {
    const content = "\n  # Tiêu đề  \n\n```js\nconsole.log(1)\n```\n\n";
    expect(lessonSchema.parse({ ...lesson, content }).content).toBe(content);
  });

  it("accepts an order of 0 or below and any video URL text", () => {
    expect(
      lessonSchema.parse({ ...lesson, order_index: "0" }).order_index,
    ).toBe(0);
    expect(
      lessonSchema.parse({ ...lesson, order_index: "-2" }).order_index,
    ).toBe(-2);
    expect(
      lessonSchema.parse({ ...lesson, video_url: " not a url, just text " })
        .video_url,
    ).toBe("not a url, just text");
  });

  it("refuses a blank title and slug, no course and no chapter", () => {
    expect(
      messagesOf(
        lessonSchema.safeParse({
          ...lesson,
          title: " ",
          slug: "",
          course_id: "",
          chapter_id: "",
        }),
      ),
    ).toEqual([
      LESSON_TITLE_MESSAGE,
      LESSON_SLUG_MESSAGE,
      LESSON_COURSE_MESSAGE,
      LESSON_CHAPTER_MESSAGE,
    ]);
  });

  it("refuses a non-integer order", () => {
    expect(
      messagesOf(lessonSchema.safeParse({ ...lesson, order_index: "1.5" })),
    ).toEqual([LESSON_ORDER_MESSAGE]);
  });
});

describe("exerciseSchema", () => {
  const exercise = {
    question: "1 + 1 = ?",
    option_a: "1",
    option_b: "2",
    option_c: "3",
    option_d: "4",
    correct_answer: "b",
    explanation: "",
  };

  it("accepts a question with four options and an answer, and stores a blank explanation as null (AC5)", () => {
    expect(
      exerciseSchema.parse({
        ...exercise,
        question: "  1 + 1 = ?  ",
        option_a: " 1 ",
      }),
    ).toEqual({
      ...exercise,
      explanation: null,
    });
  });

  it.each(["a", "b", "c", "d"])("accepts the answer %s", (correct_answer) => {
    expect(
      exerciseSchema.parse({ ...exercise, correct_answer }).correct_answer,
    ).toBe(correct_answer);
  });

  it("lowercases an answer such as the AI's A so it passes and is stored as a to d", () => {
    expect(
      exerciseSchema.parse({ ...exercise, correct_answer: " C " })
        .correct_answer,
    ).toBe("c");
  });

  it("keeps a filled explanation trimmed", () => {
    expect(
      exerciseSchema.parse({ ...exercise, explanation: "  Vì 1 + 1 = 2  " })
        .explanation,
    ).toBe("Vì 1 + 1 = 2");
  });

  it("refuses a blank question, a blank option and no answer, one message per field", () => {
    const result = exerciseSchema.safeParse({
      ...exercise,
      question: " ",
      option_c: "",
      option_d: "  ",
      correct_answer: "",
    });
    expect(messagesOf(result)).toEqual([
      EXERCISE_QUESTION_MESSAGE,
      exerciseOptionMessage("C"),
      exerciseOptionMessage("D"),
      EXERCISE_ANSWER_MESSAGE,
    ]);
  });

  it("refuses an answer outside a to d", () => {
    expect(
      messagesOf(
        exerciseSchema.safeParse({ ...exercise, correct_answer: "e" }),
      ),
    ).toEqual([EXERCISE_ANSWER_MESSAGE]);
  });

  it("refuses a missing field with the field's own message, not Zod's English text", () => {
    const { question, option_a, correct_answer, ...rest } = exercise;
    void question;
    void option_a;
    void correct_answer;
    expect(messagesOf(exerciseSchema.safeParse(rest))).toEqual([
      EXERCISE_QUESTION_MESSAGE,
      exerciseOptionMessage("A"),
      EXERCISE_ANSWER_MESSAGE,
    ]);
  });
});

describe("admin content form schemas file", () => {
  it("imports only zod, so it can run in the browser and later in NestJS (AC10)", () => {
    const source = readFileSync(
      join(__dirname, "../../lib/schemas/admin-content-forms.ts"),
      "utf8",
    );
    const imports = [...source.matchAll(/^import .* from "(.+)";$/gm)].map(
      (match) => match[1],
    );
    expect(imports).toEqual(["zod"]);
  });
});
