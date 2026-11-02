import { z } from "zod";

export const courseIdSchema = z.number().int().positive();

export type CourseId = z.input<typeof courseIdSchema>;
