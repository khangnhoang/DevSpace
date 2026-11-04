import { describe, expect, it } from "vitest";
import {
  activationEmailHtml,
  activationUrl,
  escapeHtml,
} from "@/lib/activation-email";

const BASE = "https://devspace.example";

describe("activationEmailHtml", () => {
  it("shows a learner name with markup as plain text, not as a link (SE-P2)", () => {
    const html = activationEmailHtml(
      '<a href="https://evil.example">Bấm</a> & co',
      "HTML",
      `${BASE}/course/html`,
    );

    expect(html).toContain(
      "&lt;a href=&quot;https://evil.example&quot;&gt;Bấm&lt;/a&gt; &amp; co",
    );
    expect(html).not.toContain('evil.example">');
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it("escapes the course name and the link it puts into the button", () => {
    const html = activationEmailHtml(
      "An",
      'C++ <"cơ bản">',
      `${BASE}/course/a"onclick="x`,
    );

    expect(html).toContain("C++ &lt;&quot;cơ bản&quot;&gt;");
    expect(html).toContain(`href="${BASE}/course/a&quot;onclick=&quot;x"`);
  });

  it("keeps a plain Vietnamese name and course unchanged", () => {
    const html = activationEmailHtml(
      "Nguyễn Văn A",
      "Làm quen với HTML",
      `${BASE}/learn/html/bai-1`,
    );

    expect(html).toContain("<strong>Nguyễn Văn A</strong>");
    expect(html).toContain('<strong>"Làm quen với HTML"</strong>');
    expect(html).toContain(`href="${BASE}/learn/html/bai-1"`);
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters and leaves other text", () => {
    expect(escapeHtml(`&<>"' ok`)).toBe("&amp;&lt;&gt;&quot;&#39; ok");
  });
});

describe("activationUrl", () => {
  it("links to the first lesson when the course has one", () => {
    expect(activationUrl(BASE, "lam-quen-voi-html", "bai-1")).toBe(
      `${BASE}/learn/lam-quen-voi-html/bai-1`,
    );
  });

  it.each([null, undefined, ""])(
    "links to the course page /course/<slug> when there is no lesson (%s) (BL-P6)",
    (lesson) => {
      expect(activationUrl(BASE, "lam-quen-voi-html", lesson)).toBe(
        `${BASE}/course/lam-quen-voi-html`,
      );
    },
  );

  it("links to the home page when the course slug is empty", () => {
    expect(activationUrl(BASE, "", "bai-1")).toBe(`${BASE}/`);
  });

  it("drops a trailing slash of the base URL and encodes the slugs", () => {
    expect(activationUrl(`${BASE}/`, "a b", "c/d")).toBe(
      `${BASE}/learn/a%20b/c%2Fd`,
    );
  });
});
