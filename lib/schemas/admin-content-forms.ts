import { z } from "zod";

// Client-side Zod is a UX layer (app-foundation master plan, decision 1): the admin content forms still write
// through the browser Supabase client and RLS stays the enforcement. These schemas therefore refuse only what is
// blank, a missing selection and a number the integer columns cannot hold, never a value the forms send today
// (AF-U5 plan, AC9): no slug format and no length limit the database does not have.
const blankToNull = z.literal("").transform(() => null);

const optionalText = z.string().trim().pipe(blankToNull.or(z.string()));

const requiredText = (message: string) =>
  z.string({ error: message }).trim().min(1, message);

// Number and select inputs reach the schema as strings; the schema turns them into the values the helpers write.
const isInteger = (value: string) =>
  value !== "" && Number.isInteger(Number(value));

const integerText = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .refine(isInteger, message)
    .transform(Number);

// An option's `value` is a row id, so a selection is a positive whole number; "" is the placeholder option.
const isRowId = (value: string) => /^[1-9]\d*$/.test(value);

const selectedId = (message: string) =>
  z.string({ error: message }).refine(isRowId, message).transform(Number);

export const COURSE_NAME_MESSAGE = "Vui lòng nhập tên khóa học";
export const COURSE_SLUG_MESSAGE = "Vui lòng nhập slug";
export const COURSE_PRICE_MESSAGE = "Giá phải là số nguyên từ 0 trở lên";
export const COURSE_INSTRUCTOR_MESSAGE = "Giảng viên không hợp lệ";
export const CHAPTER_TITLE_MESSAGE = "Vui lòng nhập tên chương";
export const CHAPTER_ORDER_MESSAGE = "Vui lòng nhập thứ tự là một số nguyên";
export const CHAPTER_COURSE_MESSAGE = "Vui lòng chọn khóa học";
export const LESSON_TITLE_MESSAGE = "Vui lòng nhập tên bài";
export const LESSON_SLUG_MESSAGE = "Vui lòng nhập đường dẫn";
export const LESSON_COURSE_MESSAGE = "Vui lòng chọn khóa học";
export const LESSON_CHAPTER_MESSAGE = "Vui lòng chọn chương";
export const LESSON_ORDER_MESSAGE = "Số thứ tự phải là một số nguyên";
export const EXERCISE_QUESTION_MESSAGE = "Vui lòng nhập nội dung câu hỏi";
export const EXERCISE_ANSWER_MESSAGE = "Vui lòng chọn đáp án đúng";
export const exerciseOptionMessage = (letter: "A" | "B" | "C" | "D") =>
  `Vui lòng nhập đáp án ${letter}`;

// `courses.price` is an integer, and a blank price is saved as 0 as the form always did. Description and
// instructor are optional: a blank description is null (every reader handles it).
export const courseSchema = z.object({
  name: requiredText(COURSE_NAME_MESSAGE),
  slug: requiredText(COURSE_SLUG_MESSAGE),
  description: optionalText,
  price: z
    .string({ error: COURSE_PRICE_MESSAGE })
    .trim()
    .refine(
      (value) => value === "" || (isInteger(value) && Number(value) >= 0),
      COURSE_PRICE_MESSAGE,
    )
    .transform((value) => (value === "" ? 0 : Number(value))),
  instructor_id: z
    .string({ error: COURSE_INSTRUCTOR_MESSAGE })
    .refine(
      (value) => value === "" || isRowId(value),
      COURSE_INSTRUCTOR_MESSAGE,
    )
    .transform((value) => (value === "" ? null : Number(value))),
});

// `chapters.order_index` is an integer; any integer is allowed, negative and 0 included.
export const chapterSchema = z.object({
  title: requiredText(CHAPTER_TITLE_MESSAGE),
  order_index: integerText(CHAPTER_ORDER_MESSAGE),
  course_id: selectedId(CHAPTER_COURSE_MESSAGE),
});

// The MDX content is passed exactly as typed: trimming it would change the rendered lesson, and an empty body is
// allowed. A blank video URL and a blank order are null, which `addLesson` and `editLesson` already write.
export const lessonSchema = z.object({
  title: requiredText(LESSON_TITLE_MESSAGE),
  slug: requiredText(LESSON_SLUG_MESSAGE),
  course_id: selectedId(LESSON_COURSE_MESSAGE),
  chapter_id: selectedId(LESSON_CHAPTER_MESSAGE),
  video_url: optionalText,
  order_index: z
    .string({ error: LESSON_ORDER_MESSAGE })
    .trim()
    .refine((value) => value === "" || isInteger(value), LESSON_ORDER_MESSAGE)
    .transform((value) => (value === "" ? null : Number(value))),
  content: z.string(),
});

export const EXERCISE_ANSWERS = ["a", "b", "c", "d"] as const;

// The answer is lowercased before the check so an AI answer such as "A" passes; the writes store `a` to `d`.
export const exerciseSchema = z.object({
  question: requiredText(EXERCISE_QUESTION_MESSAGE),
  option_a: requiredText(exerciseOptionMessage("A")),
  option_b: requiredText(exerciseOptionMessage("B")),
  option_c: requiredText(exerciseOptionMessage("C")),
  option_d: requiredText(exerciseOptionMessage("D")),
  correct_answer: z
    .string({ error: EXERCISE_ANSWER_MESSAGE })
    .trim()
    .toLowerCase()
    .pipe(z.enum(EXERCISE_ANSWERS, { error: EXERCISE_ANSWER_MESSAGE })),
  explanation: optionalText,
});

export type CourseFormInput = z.input<typeof courseSchema>;
export type CourseFormValues = z.output<typeof courseSchema>;
export type ChapterFormInput = z.input<typeof chapterSchema>;
export type ChapterFormValues = z.output<typeof chapterSchema>;
export type LessonFormInput = z.input<typeof lessonSchema>;
export type LessonFormValues = z.output<typeof lessonSchema>;
export type ExerciseFormInput = z.input<typeof exerciseSchema>;
export type ExerciseFormValues = z.output<typeof exerciseSchema>;
