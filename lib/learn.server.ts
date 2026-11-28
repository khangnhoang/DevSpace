import "server-only";

import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { apiFetch } from "@/lib/api.server";
import {
  lessonAnswer,
  outlineAnswer,
  queryValue,
  quizAnswer,
  readLearn,
} from "@/lib/learn-api";

// The /learn reads, through the API (TM-U5). The API decides access itself and answers 401, 403 or 404 before any
// lesson column leaves it, so these functions never decide anything: they map the answer (lib/learn-api.ts).

// The layout and the finish page ask for the same outline in one render; `cache` makes that one API call.
export const getCourseOutline = cache(async (course: string) => {
  await connection();
  return readLearn(
    () => apiFetch(`/api/learn/outline?course=${queryValue(course)}`),
    outlineAnswer,
    unstable_rethrow,
  );
});

export async function getLesson(course: string, lesson: string) {
  await connection();
  return readLearn(
    () =>
      apiFetch(
        `/api/learn/lesson?course=${queryValue(course)}&lesson=${queryValue(lesson)}`,
      ),
    lessonAnswer,
    unstable_rethrow,
  );
}

export async function getQuiz(course: string, lesson: string) {
  await connection();
  return readLearn(
    () =>
      apiFetch(
        `/api/learn/quiz?course=${queryValue(course)}&lesson=${queryValue(lesson)}`,
      ),
    quizAnswer,
    unstable_rethrow,
  );
}
