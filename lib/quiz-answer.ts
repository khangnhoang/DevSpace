// The admin form stores answers as `a` to `d`, but rows created another way may differ in case or
// spacing (BL-010), so both sides are normalized before comparing.
export function isCorrectAnswer(selected: string, correct: string): boolean {
  return selected.trim().toLowerCase() === correct.trim().toLowerCase();
}
