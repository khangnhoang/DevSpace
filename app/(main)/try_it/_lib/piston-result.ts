// Turns a Piston HTTP answer into what the console panel and the toast show. No React, Next or Supabase import,
// so a unit test reaches it without a DOM or network. The public Piston API is whitelist-only (it answers 401),
// so a non-OK status or a body without `run` is a normal case, not a connection failure.

export type PistonOutcome = "success" | "run-error" | "request-error";

export interface PistonDisplay {
  lines: string[];
  outcome: PistonOutcome;
}

interface PistonRun {
  output?: unknown;
  code?: unknown;
}

export function interpretPistonResponse(
  status: number,
  ok: boolean,
  body: unknown,
): PistonDisplay {
  const record =
    typeof body === "object" && body !== null
      ? (body as { run?: PistonRun | null; message?: unknown })
      : null;

  if (!ok || !record?.run || typeof record.run !== "object") {
    const detail =
      typeof record?.message === "string" && record.message.trim()
        ? ` ${record.message.trim()}`
        : "";
    return {
      lines: [
        `Lỗi: Server biên dịch không chạy được mã (HTTP ${status}).${detail}`,
      ],
      outcome: "request-error",
    };
  }

  const output = typeof record.run.output === "string" ? record.run.output : "";
  return {
    lines: output.split("\n"),
    outcome: record.run.code === 0 ? "success" : "run-error",
  };
}
