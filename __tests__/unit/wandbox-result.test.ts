import { describe, expect, it } from "vitest";
import {
  CUT_NOTICE_LINE,
  MAX_CONSOLE_LINES,
  TOO_MANY_RUNS_LINE,
  interpretWandboxResponse,
} from "@/app/(main)/try_it/_lib/wandbox-result";

// The answers below copy the field shapes Wandbox returned in the TM-U4 Appendix B trial (B.2, results 2 and 4),
// with invented programs; the fields the page does not read are kept so a row looks like a real answer.
function answer(fields: Partial<Record<string, unknown>>) {
  return {
    status: "0",
    signal: "",
    compiler_output: "",
    compiler_error: "",
    compiler_message: "",
    program_output: "",
    program_error: "",
    program_message: "",
    ...fields,
  };
}

const missingStatus: Record<string, unknown> = answer({});
delete missingStatus.status;

const WARNING =
  "prog.cc: In function 'int main()':\nprog.cc:3:9: warning: unused variable 'x' [-Wunused-variable]\n";

describe("interpretWandboxResponse, answered runs", () => {
  it("shows the program output line by line when the status is 0 and no signal", () => {
    expect(
      interpretWandboxResponse(
        200,
        true,
        answer({
          program_output: "Hello DevSpace from C++!\nPhép tính: 30\n",
          program_message: "Hello DevSpace from C++!\nPhép tính: 30\n",
        }),
      ),
    ).toEqual({
      lines: ["Hello DevSpace from C++!", "Phép tính: 30"],
      outcome: "success",
    });
  });

  it("shows the compiler warning before the output of a successful run", () => {
    expect(
      interpretWandboxResponse(
        200,
        true,
        answer({ compiler_error: WARNING, program_output: "ok\n" }),
      ),
    ).toEqual({
      lines: [
        "prog.cc: In function 'int main()':",
        "prog.cc:3:9: warning: unused variable 'x' [-Wunused-variable]",
        "ok",
      ],
      outcome: "success",
    });
  });

  it("shows the compiler message and the closing line when the program does not compile", () => {
    expect(
      interpretWandboxResponse(
        200,
        true,
        answer({
          status: "1",
          compiler_error:
            "prog.cc:2:1: error: 'x' was not declared in this scope\n",
        }),
      ),
    ).toEqual({
      lines: [
        "prog.cc:2:1: error: 'x' was not declared in this scope",
        "Biên dịch hoặc chạy không thành công (mã thoát 1).",
      ],
      outcome: "run-error",
    });
  });

  it("reports compiler text with a non-zero status and no program text as a failure", () => {
    expect(
      interpretWandboxResponse(
        200,
        true,
        answer({ status: "1", compiler_error: WARNING }),
      ),
    ).toEqual({
      lines: [
        "prog.cc: In function 'int main()':",
        "prog.cc:3:9: warning: unused variable 'x' [-Wunused-variable]",
        "Biên dịch hoặc chạy không thành công (mã thoát 1).",
      ],
      outcome: "run-error",
    });
  });

  it("shows the standard output, then the standard error, then the closing line for an uncaught exception", () => {
    expect(
      interpretWandboxResponse(
        200,
        true,
        answer({
          status: "134",
          program_output: "before\n",
          program_error:
            "terminate called after throwing an instance of 'std::runtime_error'\n  what():  boom\n",
        }),
      ),
    ).toEqual({
      lines: [
        "before",
        "terminate called after throwing an instance of 'std::runtime_error'",
        "  what():  boom",
        "Biên dịch hoặc chạy không thành công (mã thoát 134).",
      ],
      outcome: "run-error",
    });
  });

  it("shows the closing line alone for a segmentation fault, which returns no text", () => {
    expect(
      interpretWandboxResponse(200, true, answer({ status: "139" })),
    ).toEqual({
      lines: ["Biên dịch hoặc chạy không thành công (mã thoát 139)."],
      outcome: "run-error",
    });
  });

  it("reports a run with status 0 but a signal as a failure that names the signal", () => {
    expect(
      interpretWandboxResponse(
        200,
        true,
        answer({ status: "0", signal: "Killed", program_output: "a\n" }),
      ),
    ).toEqual({
      lines: [
        "a",
        "Biên dịch hoặc chạy không thành công (mã thoát 0, tín hiệu Killed).",
      ],
      outcome: "run-error",
    });
  });

  it("reports an empty status as a failure, never an empty success", () => {
    expect(
      interpretWandboxResponse(
        200,
        true,
        answer({ status: "", program_output: "x\nx\n" }),
      ),
    ).toEqual({
      lines: ["x", "x", "Biên dịch hoặc chạy không thành công."],
      outcome: "run-error",
    });
  });
});

describe("interpretWandboxResponse, the line cap", () => {
  const output = (count: number) =>
    Array.from({ length: count }, (_, i) => `line ${i + 1}`).join("\n") + "\n";

  it(`shows exactly ${MAX_CONSOLE_LINES} lines whole`, () => {
    const display = interpretWandboxResponse(
      200,
      true,
      answer({ program_output: output(MAX_CONSOLE_LINES) }),
    );
    expect(display.outcome).toBe("success");
    expect(display.lines).toHaveLength(MAX_CONSOLE_LINES);
    expect(display.lines.at(-1)).toBe(`line ${MAX_CONSOLE_LINES}`);
  });

  it("ends a longer failing output with the cut notice and then the closing line", () => {
    const display = interpretWandboxResponse(
      200,
      true,
      answer({ status: "", program_output: output(MAX_CONSOLE_LINES + 1) }),
    );
    expect(display.outcome).toBe("run-error");
    expect(display.lines).toHaveLength(MAX_CONSOLE_LINES + 2);
    expect(display.lines.slice(-3)).toEqual([
      `line ${MAX_CONSOLE_LINES}`,
      CUT_NOTICE_LINE,
      "Biên dịch hoặc chạy không thành công.",
    ]);
  });
});

describe("interpretWandboxResponse, unusable answers", () => {
  it("tells the visitor to wait a few minutes after HTTP 429", () => {
    expect(interpretWandboxResponse(429, false, null)).toEqual({
      lines: [TOO_MANY_RUNS_LINE],
      outcome: "request-error",
    });
    expect(TOO_MANY_RUNS_LINE).toContain("429");
  });

  it.each([500, 422, 403])(
    "shows one error line with HTTP %i for a refusal with a plain-text body",
    (status) => {
      expect(interpretWandboxResponse(status, false, null)).toEqual({
        lines: [`Lỗi: Server biên dịch không chạy được mã (HTTP ${status}).`],
        outcome: "request-error",
      });
    },
  );

  it("shows the error line for a non-OK status even with a well-formed body", () => {
    expect(interpretWandboxResponse(500, false, answer({}))).toEqual({
      lines: ["Lỗi: Server biên dịch không chạy được mã (HTTP 500)."],
      outcome: "request-error",
    });
  });

  it.each([
    ["a missing status", missingStatus],
    ["a numeric status", answer({ status: 0 })],
    ["a null program_output", answer({ program_output: null })],
    ["a non-JSON body", null],
    ["an array", []],
    ["a string", "<html>"],
  ])("shows the HTTP 200 error line for %s", (_case, body) => {
    expect(interpretWandboxResponse(200, true, body)).toEqual({
      lines: ["Lỗi: Server biên dịch không chạy được mã (HTTP 200)."],
      outcome: "request-error",
    });
  });
});
