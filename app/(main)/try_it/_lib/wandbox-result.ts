// Turns a Wandbox HTTP answer into what the console panel and the toast show. No React, Next or Supabase import,
// so a unit test reaches it without a DOM or network. Wandbox gives no field that tells a compile failure from a
// run failure (a warning plus `return 1` looks like a compile error), so a failure is reported as one kind.

export const MAX_CONSOLE_LINES = 1_000;

export type RunOutcome = "success" | "run-error" | "request-error";

export interface RunDisplay {
  lines: string[];
  outcome: RunOutcome;
}

interface WandboxAnswer {
  status: string;
  signal: string;
  compiler_error: string;
  program_output: string;
  program_error: string;
}

const ANSWER_FIELDS = [
  "status",
  "signal",
  "compiler_error",
  "program_output",
  "program_error",
] as const;

export const TOO_MANY_RUNS_LINE =
  "Lỗi: Bạn đã chạy code quá nhiều lần trong thời gian ngắn. Vui lòng đợi vài phút rồi thử lại. (HTTP 429)";
export const CUT_NOTICE_LINE = `… Kết quả quá dài: chỉ hiện ${MAX_CONSOLE_LINES} dòng đầu, phần còn lại đã bị cắt bớt.`;

function isAnswer(body: unknown): body is WandboxAnswer {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    return false;
  const record = body as Record<string, unknown>;
  return ANSWER_FIELDS.every((field) => typeof record[field] === "string");
}

// One trailing newline ends the last line rather than opening an empty one; empty text adds no line.
function textLines(text: string): string[] {
  if (text === "") return [];
  return text.replace(/\r?\n$/, "").split(/\r?\n/);
}

function capped(lines: string[]): string[] {
  if (lines.length <= MAX_CONSOLE_LINES) return lines;
  return [...lines.slice(0, MAX_CONSOLE_LINES), CUT_NOTICE_LINE];
}

function failureLine(status: string, signal: string): string {
  const details = [
    status !== "" ? `mã thoát ${status}` : null,
    signal !== "" ? `tín hiệu ${signal}` : null,
  ].filter((detail) => detail !== null);
  return details.length > 0
    ? `Biên dịch hoặc chạy không thành công (${details.join(", ")}).`
    : "Biên dịch hoặc chạy không thành công.";
}

export function interpretWandboxResponse(
  status: number,
  ok: boolean,
  body: unknown,
): RunDisplay {
  if (status === 429)
    return { lines: [TOO_MANY_RUNS_LINE], outcome: "request-error" };
  if (!ok || !isAnswer(body))
    return {
      lines: [`Lỗi: Server biên dịch không chạy được mã (HTTP ${status}).`],
      outcome: "request-error",
    };

  // An empty `status` (the output was cut by Wandbox) is a failure, never an empty success.
  if (body.status === "0" && body.signal === "")
    return {
      lines: capped([
        ...textLines(body.compiler_error),
        ...textLines(body.program_output),
      ]),
      outcome: "success",
    };

  // The closing line comes after the cut, so it always ends the console.
  return {
    lines: [
      ...capped([
        ...textLines(body.compiler_error),
        ...textLines(body.program_output),
        ...textLines(body.program_error),
      ]),
      failureLine(body.status, body.signal),
    ],
    outcome: "run-error",
  };
}
