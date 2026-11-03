import { describe, expect, it } from "vitest";
import { formatDateTime, formatVnd } from "@/lib/format-vi";

describe("formatVnd", () => {
  it.each([
    [0, "0đ"],
    [999, "999đ"],
    [1000, "1.000đ"],
    [199000, "199.000đ"],
    [1234567, "1.234.567đ"],
    [-199000, "-199.000đ"],
  ])("writes %d as %s", (amount, text) => {
    expect(formatVnd(amount)).toBe(text);
  });
});

describe("formatDateTime", () => {
  it("shows day, month, year and hour:minute without seconds, zero padded", () => {
    expect(formatDateTime(new Date(2026, 10, 3, 14, 5, 59).toISOString())).toBe("03/11/2026 14:05");
    expect(formatDateTime(new Date(2026, 0, 9, 0, 0, 0))).toBe("09/01/2026 00:00");
  });

  it("returns an empty string for a value that is not a date", () => {
    expect(formatDateTime("not a date")).toBe("");
  });
});
