import {
  exerciseSchema,
  type ExerciseFormInput,
  type ExerciseFormValues,
} from "@/lib/schemas/admin-content-forms";

// The check and the bulk save of the AI exercise buttons live here, away from the page, so they can be tested without
// the AI key, a network, React or a Supabase client (AF-U5 plan, G4). `addExercise` is passed in for the same reason.

export const AI_INVALID_MESSAGE = "Kết quả từ AI không hợp lệ";

type AddExercise = (
  lessonId: number,
  exercise: ExerciseFormValues,
) => Promise<{ error?: unknown }>;

export type AiBulkOutcome =
  | { kind: "invalid" }
  | { kind: "saved"; count: number }
  | { kind: "partial"; saved: number; total: number };

// The generated result must be a non-empty list in which every question passes the exercise schema; one bad
// question refuses the whole set, so nothing half-valid is saved. The parsed values (trimmed, answer in lowercase)
// are what gets saved.
export function checkAiExercises(data: unknown): ExerciseFormValues[] | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const items: ExerciseFormValues[] = [];
  for (const item of data) {
    const parsed = exerciseSchema.safeParse(item);
    if (!parsed.success) return null;
    items.push(parsed.data);
  }
  return items;
}

// Waits for every save: a failed result and a thrown call both count as not saved.
export async function saveAiExercises(
  lessonId: number,
  items: ExerciseFormValues[],
  addExercise: AddExercise,
): Promise<AiBulkOutcome> {
  const results = await Promise.all(
    items.map(async (item) => {
      try {
        return !(await addExercise(lessonId, item)).error;
      } catch {
        return false;
      }
    }),
  );
  const saved = results.filter(Boolean).length;
  if (saved === items.length) return { kind: "saved", count: saved };
  return { kind: "partial", saved, total: items.length };
}

export async function bulkCreateAiExercises(
  lessonId: number,
  data: unknown,
  addExercise: AddExercise,
): Promise<AiBulkOutcome> {
  const items = checkAiExercises(data);
  if (!items) return { kind: "invalid" };
  return saveAiExercises(lessonId, items, addExercise);
}

export function describeAiBulk(outcome: AiBulkOutcome) {
  switch (outcome.kind) {
    case "invalid":
      return {
        ok: false,
        message: `${AI_INVALID_MESSAGE}, chưa lưu câu hỏi nào`,
      };
    case "saved":
      return {
        ok: true,
        message: `Đã thêm thành công ${outcome.count} câu hỏi!`,
      };
    case "partial":
      return {
        ok: false,
        message: `Chỉ lưu được ${outcome.saved}/${outcome.total} câu hỏi, vui lòng thử lại`,
      };
  }
}

// "Điền vào form" fills the exercise form from the first generated question. A missing field stays blank and the form's
// own checks name it on save; the answer is lowercased so an AI "A" selects the option a.
export function firstAiExerciseToForm(data: unknown): ExerciseFormInput | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const first: unknown = data[0];
  if (typeof first !== "object" || first === null) return null;
  const text = (key: string) => {
    const value = (first as Record<string, unknown>)[key];
    return typeof value === "string" ? value : "";
  };
  return {
    question: text("question"),
    option_a: text("option_a"),
    option_b: text("option_b"),
    option_c: text("option_c"),
    option_d: text("option_d"),
    correct_answer: text("correct_answer").trim().toLowerCase(),
    explanation: text("explanation"),
  };
}
