export type TryItLanguage = "html" | "javascript" | "cpp";

const FENCE_LANGUAGES: Record<string, TryItLanguage> = {
  html: "html",
  js: "javascript",
  javascript: "javascript",
  cpp: "cpp",
  "c++": "cpp",
};

// The language of a lesson code block from the `language-*` class MDX puts on its `<code>`. A block with no
// language opens the HTML tab as it always did; any other language returns null, so the block gets no "Thử ngay".
export function tryItLanguage(className: string | undefined): TryItLanguage | null {
  const fence = className?.split(/\s+/).find((token) => token.startsWith("language-"));
  if (!fence) return "html";
  return FENCE_LANGUAGES[fence.slice("language-".length).toLowerCase()] ?? null;
}

// `lang` comes from a link anyone can craft: anything but the three values opens the HTML tab.
export function parseTryItLanguage(lang: string | null): TryItLanguage {
  const known = Object.values(FENCE_LANGUAGES);
  return known.find((language) => language === lang) ?? "html";
}

export function tryItHref(code: string, language: TryItLanguage): string {
  return `/try_it?lang=${language}&code=${encodeURIComponent(code)}`;
}

// `URLSearchParams.get` already decoded `code`: decoding it again throws on `50%` and changes `a%20b`.
export function readTryItParams(params: Pick<URLSearchParams, "get">): { code: string | null; language: TryItLanguage } {
  // An empty `code` opens the default example, as it did before.
  return { code: params.get("code") || null, language: parseTryItLanguage(params.get("lang")) };
}
