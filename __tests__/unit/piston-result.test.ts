import { describe, expect, it } from "vitest";
import { interpretPistonResponse } from "@/app/(main)/try_it/_lib/piston-result";

describe("interpretPistonResponse", () => {
  it("shows the program output as lines when the run exits with 0", () => {
    expect(
      interpretPistonResponse(200, true, {
        run: { output: "Xin chào\nDevSpace\n", code: 0 },
      }),
    ).toEqual({ lines: ["Xin chào", "DevSpace", ""], outcome: "success" });
  });

  it("keeps the compiler output but reports a run error when the exit code is not 0", () => {
    expect(
      interpretPistonResponse(200, true, {
        run: { output: "error: boom", code: 1 },
      }),
    ).toEqual({ lines: ["error: boom"], outcome: "run-error" });
  });

  it("shows the HTTP status and the server message for a 401", () => {
    const display = interpretPistonResponse(401, false, {
      message: "Public Piston API is now whitelist only",
    });
    expect(display.outcome).toBe("request-error");
    expect(display.lines).toHaveLength(1);
    expect(display.lines[0]).toContain("401");
    expect(display.lines[0]).toContain("whitelist only");
  });

  it("shows an error line for an OK answer without a run", () => {
    const display = interpretPistonResponse(200, true, { message: "no run" });
    expect(display.outcome).toBe("request-error");
    expect(display.lines[0]).toContain("200");
  });

  it.each([null, undefined, "<html>", 42, { run: null }])(
    "shows an error line for an unusable body %j",
    (body) => {
      const display = interpretPistonResponse(502, false, body);
      expect(display.outcome).toBe("request-error");
      expect(display.lines[0]).toContain("502");
    },
  );
});
