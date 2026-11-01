import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyMonaco } from "../../scripts/monaco/copy-vs.mjs";

// Every file path under `root`, relative and with its content, so two trees compare exactly.
function snapshot(root: string, prefix = ""): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(files, snapshot(root, relative));
    else files[relative] = readFileSync(join(root, relative), "utf8");
  }
  return files;
}

describe("copyMonaco", () => {
  let dir: string;
  let source: string;
  let destination: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "monaco-copy-"));
    source = join(dir, "source");
    destination = join(dir, "public", "monaco", "vs");
    mkdirSync(join(source, "editor"), { recursive: true });
    writeFileSync(join(source, "loader.js"), "loader");
    writeFileSync(join(source, "editor", "editor.main.js"), "editor");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("copies a fresh tree equal to the source", () => {
    copyMonaco(source, destination);
    expect(snapshot(destination)).toEqual(snapshot(source));
  });

  it("removes a stale file and replaces changed content on a second copy", () => {
    copyMonaco(source, destination);
    writeFileSync(join(destination, "stale.js"), "old version");
    writeFileSync(join(source, "loader.js"), "loader 2");
    rmSync(join(source, "editor"), { recursive: true });

    copyMonaco(source, destination);

    expect(snapshot(destination)).toEqual({ "loader.js": "loader 2" });
  });

  it("throws naming the folder when the source is missing and leaves the old copy alone", () => {
    copyMonaco(source, destination);
    const missing = join(dir, "no-such-folder");

    expect(() => copyMonaco(missing, destination)).toThrow(missing);
    expect(snapshot(destination)).toEqual(snapshot(source));
  });
});
