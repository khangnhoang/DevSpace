// Sends one C++ run to Wandbox from the visitor's browser and turns every way it can end into a result. No React,
// Next or Supabase import, and `fetch` is a parameter, so a unit test reaches it without a DOM or network.
// The call must stay in the browser: Wandbox refused the one non-browser client tried and limits requests per IP
// (TM-U4 plan, Appendix B, B-G1).

import { interpretWandboxResponse, type RunDisplay } from "./wandbox-result";

export const WANDBOX_URL = "https://wandbox.org/api/compile.json";
// Pinned on purpose (B-D3): when Wandbox retires it, every run shows the request error until this changes.
export const WANDBOX_COMPILER = "gcc-13.2.0";
// An endless loop kept the request open past 38 seconds in the trial; ordinary runs took 2 to 5 seconds.
export const RUN_DEADLINE_MS = 30_000;

export const TIMEOUT_LINE = `Lỗi: Đã ngừng chờ kết quả vì chương trình chạy quá lâu (hơn ${RUN_DEADLINE_MS / 1000} giây). Hãy kiểm tra xem code có vòng lặp vô hạn không.`;
export const CONNECTION_LINE = "Lỗi: Không thể kết nối đến server biên dịch.";

export type CppRunResult =
  | RunDisplay
  | { lines: string[]; outcome: "timeout" | "connection-error" }
  | { outcome: "aborted" };

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

export async function runCpp(
  code: string,
  fetchFn: Fetch,
  signal: AbortSignal,
): Promise<CppRunResult> {
  // One controller ends the request on either the caller's abort or the deadline; a plain timer instead of
  // AbortSignal.timeout keeps the deadline under a test's fake timers.
  const controller = new AbortController();
  let timedOut = false;

  // Resolves on the abort itself, so the run ends at the deadline or on the caller's abort even when the request
  // or its body ignores the signal (an abort while the body is read is swallowed by the `.catch` below).
  const stopped = new Promise<CppRunResult>((resolve) =>
    controller.signal.addEventListener("abort", () =>
      resolve(
        timedOut
          ? { lines: [TIMEOUT_LINE], outcome: "timeout" }
          : { outcome: "aborted" },
      ),
    ),
  );

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, RUN_DEADLINE_MS);
  const onAbort = () => controller.abort();
  if (signal.aborted) controller.abort();
  else signal.addEventListener("abort", onAbort);

  const answered = (async (): Promise<CppRunResult> => {
    try {
      // Only the code and the compiler name leave the page: no cookie, no referrer, no identifier (B-G4).
      const res = await fetchFn(WANDBOX_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compiler: WANDBOX_COMPILER, code }),
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      // A refusal is plain text ("Error: Too many requests"), which is read as no body.
      const body: unknown = await res.json().catch(() => null);
      return interpretWandboxResponse(res.status, res.ok, body);
    } catch {
      return { lines: [CONNECTION_LINE], outcome: "connection-error" };
    }
  })();

  try {
    return await Promise.race([answered, stopped]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}
