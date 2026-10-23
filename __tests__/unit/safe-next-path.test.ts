import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-next-path";

describe("safeNextPath", () => {
  it.each(["/", "/auth/reset-password"])("keeps the allowlisted path %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    ["null", null],
    ["an empty string", ""],
    ["an unknown path", "/admin"],
    ["an absolute URL", "https://evil.example"],
    ["a protocol-relative URL", "//evil.example"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["an allowlisted path with a query string", "/auth/reset-password?x=1"],
  ])("falls back to / for %s", (_label, raw) => {
    expect(safeNextPath(raw)).toBe("/");
  });
});
