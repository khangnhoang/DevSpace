import { z } from "zod";

// A slug as the /learn URLs carry it. It has no upper bound because the admin lesson form sets none, so any stored
// slug must still be found; a slug that matches no row is a 404 from the lookup, not a validation failure.
const slug = z
  .string()
  .min(1)
  .refine((value) => !value.includes("\0"));

export const learnOutlineQuery = z.object({ course: slug });

export const learnLessonQuery = z.object({ course: slug, lesson: slug });

export type LearnOutlineQuery = z.output<typeof learnOutlineQuery>;
export type LearnLessonQuery = z.output<typeof learnLessonQuery>;
