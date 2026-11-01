import { describe, expect, it } from "vitest";
import { parseTryItLanguage, readTryItParams, tryItHref, tryItLanguage } from "@/lib/try-it";

describe("tryItLanguage", () => {
  it.each([
    ["language-html", "html"],
    ["language-js", "javascript"],
    ["language-javascript", "javascript"],
    ["language-cpp", "cpp"],
    ["language-c++", "cpp"],
    ["language-JS", "javascript"],
    ["hljs language-js", "javascript"],
  ])("maps the class %s to the %s tab", (className, language) => {
    expect(tryItLanguage(className)).toBe(language);
  });

  it.each([
    ["no class", undefined],
    ["an empty class", ""],
    ["a class without a language", "hljs"],
  ])("opens the HTML tab for %s", (_, className) => {
    expect(tryItLanguage(className)).toBe("html");
  });

  it.each(["language-css", "language-python", "language-", "language-constructor", "language-__proto__", "language-toString"])("gives %s no Thử ngay button", (className) => {
    expect(tryItLanguage(className)).toBeNull();
  });
});

describe("parseTryItLanguage", () => {
  it.each(["html", "javascript", "cpp"] as const)("keeps %s", (lang) => {
    expect(parseTryItLanguage(lang)).toBe(lang);
  });

  it.each([null, "", "css", "js", "JAVASCRIPT", "constructor", "__proto__"])("opens the HTML tab for %j", (lang) => {
    expect(parseTryItLanguage(lang)).toBe("html");
  });
});

// BL-P4: the code a lesson block sends must be the code the editor receives, with `%` untouched.
describe("the Try It link", () => {
  it.each([
    ["a percent sign in CSS", "p { width: 50%; }"],
    ["an encoded-looking sequence", "a%20b"],
    ["a printf format", 'printf("%d", x);'],
    ["markup and symbols", "<p>50%</p>\n& \"quoted\" + plus #hash"],
  ])("round-trips %s exactly", (_, code) => {
    const url = new URL(tryItHref(code, "cpp"), "http://127.0.0.1:3000");
    expect(readTryItParams(url.searchParams)).toEqual({ code, language: "cpp" });
  });

  it.each(["", "code=", "lang=cpp&code="])("reads the link ?%s as no code", (query) => {
    expect(readTryItParams(new URLSearchParams(query)).code).toBeNull();
  });

  it("reads a link without code or lang as no code in the HTML tab", () => {
    expect(readTryItParams(new URLSearchParams(""))).toEqual({ code: null, language: "html" });
  });
});
