import { z } from "zod";
import { CONTENT_TOO_SHORT_MESSAGE } from "./parse-failure";

// Object schemas strip unknown keys: the lessons page sends whole DBExercise rows
// as previousQuestion, and only the question text reaches the prompt.
export const quizRequestSchema = z.object({
  content: z.string().min(50, CONTENT_TOO_SHORT_MESSAGE),
  quantity: z.number().int().min(1).max(3).default(1),
  previousQuestion: z.array(z.object({ question: z.string() })),
});

export type QuizRequestInput = z.input<typeof quizRequestSchema>;
