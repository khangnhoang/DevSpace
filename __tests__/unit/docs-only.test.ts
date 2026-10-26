import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isDocsOnly, parsePaths } from "../../scripts/ci/docs-only.mjs";

const script = fileURLToPath(new URL("../../scripts/ci/docs-only.mjs", import.meta.url));
const LICENSE = ".claude/skills/playwright-cli/LICENSE";

function runCli(input: string | Buffer) {
  const result = spawnSync(process.execPath, [script], { input });
  return { stdout: result.stdout.toString(), status: result.status };
}

const nul = (...paths: string[]) => paths.map((path) => `${path}\0`).join("");

describe("isDocsOnly", () => {
  it("accepts Markdown files anywhere, including the root and dot folders", () => {
    expect(isDocsOnly(["docs/programs/infrastructure/progress.md"])).toBe(true);
    expect(isDocsOnly(["CLAUDE.md", "README.md", ".claude/rules.md", ".github/pull_request_template.md"])).toBe(true);
  });

  it("accepts the vendored playwright-cli LICENSE next to Markdown", () => {
    expect(isDocsOnly([LICENSE])).toBe(true);
    expect(isDocsOnly([LICENSE, "docs/README.md"])).toBe(true);
  });

  it("rejects an empty list", () => {
    expect(isDocsOnly([])).toBe(false);
  });

  it.each([
    ".github/workflows/ci.yml",
    "scripts/ci/docs-only.mjs",
    "supabase/migrations/20261021000000_baseline.sql",
    "__tests__/unit/docs-only.test.ts",
    "app/page.tsx",
    "lib/auth.server.ts",
    "package.json",
    "package-lock.json",
    ".claude/settings.json",
    ".claude/launch.json",
  ])("rejects the code or config file %s, alone or beside docs", (path) => {
    expect(isDocsOnly([path])).toBe(false);
    expect(isDocsOnly(["docs/README.md", path])).toBe(false);
  });

  it("rejects a deleted code file listed beside docs", () => {
    expect(isDocsOnly(["docs/notes.md", "app/old-page.tsx"])).toBe(false);
  });

  it("rejects a rename from code to docs when both paths are listed", () => {
    expect(isDocsOnly(["app/x.ts", "docs/x.md"])).toBe(false);
  });

  it("rejects a new non-Markdown file under docs and .claude/skills", () => {
    expect(isDocsOnly(["docs/diagram.png"])).toBe(false);
    expect(isDocsOnly(["docs/scripts/build.sh"])).toBe(false);
    expect(isDocsOnly([".claude/skills/example/data.json"])).toBe(false);
    expect(isDocsOnly([".claude/skills/example/LICENSE"])).toBe(false);
  });

  it("rejects near misses of the two docs rules", () => {
    expect(isDocsOnly(["docs/notes.md.bak"])).toBe(false);
    expect(isDocsOnly(["docs/notes.MD"])).toBe(false);
    expect(isDocsOnly(["docs/notes.mdx"])).toBe(false);
    expect(isDocsOnly([`${LICENSE}.txt`])).toBe(false);
    expect(isDocsOnly([`x/${LICENSE}`])).toBe(false);
  });

  it("accepts a path with a space and rejects a path with a newline that hides a non-docs name", () => {
    expect(isDocsOnly(["docs/my notes.md"])).toBe(true);
    expect(isDocsOnly(["docs/a.md\nsrc/evil.ts"])).toBe(false);
    expect(isDocsOnly(["docs/a b.ts"])).toBe(false);
  });

  it("rejects input that is not a list of non-empty strings", () => {
    expect(isDocsOnly(undefined)).toBe(false);
    expect(isDocsOnly("docs/a.md")).toBe(false);
    expect(isDocsOnly([""])).toBe(false);
    expect(isDocsOnly([null])).toBe(false);
  });
});

describe("parsePaths", () => {
  it("splits NUL-terminated paths and keeps spaces and newlines inside a path", () => {
    expect(parsePaths(Buffer.from(nul("docs/my notes.md", "a\nb.md")))).toEqual(["docs/my notes.md", "a\nb.md"]);
  });

  it("returns an empty list for empty input", () => {
    expect(parsePaths(Buffer.alloc(0))).toEqual([]);
  });

  it("throws on cut-off input, an empty path and invalid UTF-8", () => {
    expect(() => parsePaths(Buffer.from("docs/a.md"))).toThrow();
    expect(() => parsePaths(Buffer.from("\0"))).toThrow();
    expect(() => parsePaths(Buffer.from(`${nul("docs/a.md")}\0`))).toThrow();
    expect(() => parsePaths(Buffer.from([0xff, 0xfe, 0x00]))).toThrow();
  });
});

describe("docs-only CLI", () => {
  it("prints true for docs paths", () => {
    expect(runCli(nul("docs/a.md", "CLAUDE.md", LICENSE))).toEqual({ stdout: "true\n", status: 0 });
  });

  it("prints false for mixed code and docs", () => {
    expect(runCli(nul("docs/a.md", "app/page.tsx"))).toEqual({ stdout: "false\n", status: 0 });
  });

  it("prints false for a rename listed as old and new path", () => {
    expect(runCli(nul("app/x.ts", "docs/x.md"))).toEqual({ stdout: "false\n", status: 0 });
  });

  it("prints false for empty input", () => {
    expect(runCli("")).toEqual({ stdout: "false\n", status: 0 });
  });

  it("keeps a path with a space whole", () => {
    expect(runCli(nul("docs/my notes.md"))).toEqual({ stdout: "true\n", status: 0 });
  });

  it("never prints true for newline-separated input", () => {
    const result = runCli("docs/a.md\ndocs/b.md\n");
    expect(result.stdout).not.toContain("true");
    expect(result.status).not.toBe(0);
  });

  it("never prints true for cut-off, empty-path or invalid-UTF-8 input", () => {
    for (const input of [Buffer.from("docs/a.md"), Buffer.from(`${nul("docs/a.md")}\0`), Buffer.from([0xff, 0x00])]) {
      const result = runCli(input);
      expect(result.stdout).not.toContain("true");
      expect(result.status).not.toBe(0);
    }
  });
});
