import { z } from "zod";

export const REVIEWS_PER_PAGE = 5;
export const LAST_REVIEW_PAGE = 9;

export const courseDetailQuery = z.object({
  slug: z
    .string()
    .min(1)
    .refine((slug) => !slug.includes("\0")),
});

export const courseReviewsQuery = z.object({
  courseId: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.int().positive()),
  page: z
    .string()
    .regex(/^(0|[1-9]\d*)$/)
    .transform(Number)
    .pipe(z.int().min(0).max(LAST_REVIEW_PAGE)),
});

export type CourseDetailQuery = z.output<typeof courseDetailQuery>;
export type CourseReviewsQuery = z.output<typeof courseReviewsQuery>;
