import { z } from "zod";

// A slug as the /learn URLs carry it. The bounds only keep an absurd value out of a query; a slug that matches no row
// is a 404 from the lookup, not a validation failure.
const slug = z
  .string()
  .min(1)
  .max(255)
  .refine((value) => !value.includes("\0"));

export const learnOutlineQuery = z.object({ course: slug });

export const learnLessonQuery = z.object({ course: slug, lesson: slug });

export type LearnOutlineQuery = z.output<typeof learnOutlineQuery>;
export type LearnLessonQuery = z.output<typeof learnLessonQuery>;
