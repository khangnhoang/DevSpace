import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Where the e2e server writes what the server guard refused and what the mail record caught. The directory is
// ignored by git (`.gitignore`) and scripts/e2e/serve.mjs empties both files before it starts the server.
export function serverRecordPaths(root: string) {
  const dir = join(root, "__tests__", "e2e", ".server");
  return {
    dir,
    guard: join(dir, "guard.jsonl"),
    mail: join(dir, "mail.jsonl"),
    auth: join(dir, "auth.jsonl"),
  };
}

export type GuardRecord = {
  kind: "dns" | "connect";
  host: string;
  port: number | null;
  time: number;
};
export type MailRecord = { to: string; subject: string; time: number };
// A call of the server to Auth: the session refresh or the token check, with its status ("error" when no answer came).
export type AuthRecord = {
  kind: "refresh" | "user";
  status: number | "error";
  time: number;
  durationMs: number;
};

export function recordSize(file: string): number {
  return existsSync(file) ? statSync(file).size : 0;
}

// The lines that were appended after `offset` bytes. A line that does not parse is an error, not skipped: a
// half-written or foreign record must not hide a refusal.
export function recordsSince<T>(file: string, offset: number): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file)
    .subarray(offset)
    .toString("utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as T);
}
