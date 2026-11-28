import { z } from "zod";

// The answers of the /api/learn routes (TM-U5) and the mapping of a response to what a page does. This file holds no
// Next or Supabase import so a unit test can run it with a fake `fetch`; the server functions that call the API
// through `apiFetch` are in lib/learn.server.ts. Next parses every 200 body with these schemas before using it (G4):
// a body that does not match is an unavailable API, never a lesson rendered from guesses. Object schemas strip the
// keys the pages do not read.

const access = {
  user: z.object({ id: z.string().min(1) }),
  course: z.object({ id: z.number().int(), slug: z.string() }),
  isAdmin: z.boolean(),
};

const outlineLesson = z.object({
  id: z.number().int(),
  title: z.string(),
  slug: z.string(),
  has_video: z.boolean(),
  has_exercise: z.boolean(),
});

const outlineChapter = z.object({
  id: z.number().int(),
  title: z.string(),
  order_index: z.number().int().nullable(),
  lessons: z.array(outlineLesson),
});

export const outlineAnswer = z.object({
  ...access,
  chapters: z.array(outlineChapter),
});

export const lessonAnswer = z.object({
  ...access,
  lesson: z.object({
    id: z.number().int(),
    title: z.string(),
    slug: z.string(),
    course_id: z.number().int(),
    chapter_id: z.number().int().nullable(),
    order_index: z.number().int().nullable(),
    created_at: z.string(),
    has_video: z.boolean(),
  }),
  content: z.string().nullable(),
  video_url: z.string().nullable(),
  chapters: z.array(outlineChapter),
});

export const quizAnswer = z.object({
  ...access,
  lesson: z.object({
    id: z.number().int(),
    title: z.string(),
    slug: z.string(),
  }),
  chapters: z.array(outlineChapter),
});

export type LearnChapter = z.output<typeof outlineChapter>;
export type OutlineAnswer = z.output<typeof outlineAnswer>;
export type LessonAnswer = z.output<typeof lessonAnswer>;
export type QuizAnswer = z.output<typeof quizAnswer>;

// What a page needs to know about one read. Only the API's own refusal codes name a refusal; everything else (a 5xx,
// a network error, a redirect, a body of the wrong shape) is `unavailable`, which no page turns into a redirect.
export type LearnRead<T> =
  | { status: "ok"; data: T }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "missing" }
  | { status: "unavailable" };

type Parser<T> = {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
};

// `rethrow` lets the Next side pass `unstable_rethrow`, so the signal Next throws to mark a render dynamic is not
// swallowed as an outage. The log names a status or the type of an error only: never the body, a cookie or a lesson.
export async function readLearn<T>(
  call: () => Promise<Response>,
  schema: Parser<T>,
  rethrow: (error: unknown) => void = () => {},
): Promise<LearnRead<T>> {
  let response: Response;
  try {
    response = await call();
  } catch (error) {
    rethrow(error);
    console.error(
      "Lỗi lấy bài học",
      error instanceof Error ? error.name : "unknown error",
    );
    return { status: "unavailable" };
  }
  if (response.status === 401) return { status: "unauthenticated" };
  if (response.status === 403) return { status: "forbidden" };
  if (response.status === 404) return { status: "missing" };
  if (response.status !== 200) {
    console.error(`Lỗi lấy bài học: the API answered ${response.status}`);
    return { status: "unavailable" };
  }
  try {
    const parsed = schema.safeParse(await response.json());
    if (parsed.success) return { status: "ok", data: parsed.data };
  } catch (error) {
    console.error(
      "Lỗi lấy bài học",
      error instanceof Error ? error.name : "unknown error",
    );
    return { status: "unavailable" };
  }
  console.error("Lỗi lấy bài học: the API answer does not match its schema");
  return { status: "unavailable" };
}

// The same percent-escaping the other server functions use for a value in a query: apiFetch allows escapes and
// rejects raw punctuation and dot pairs.
export function queryValue(value: string): string {
  return encodeURIComponent(value).replace(
    /[.!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

// What a /learn page does with a read that did not return data. `null` means the read has data.
export type LearnOutcome =
  { redirect: string } | { notFound: true } | { unavailable: true };

export function learnOutcome(
  read: LearnRead<unknown>,
  courseSlug: string,
): LearnOutcome | null {
  switch (read.status) {
    case "ok":
      return null;
    case "unauthenticated":
      return { redirect: "/login" };
    case "forbidden":
      return { redirect: `/course/${courseSlug}` };
    case "missing":
      return { notFound: true };
    case "unavailable":
      return { unavailable: true };
  }
}
