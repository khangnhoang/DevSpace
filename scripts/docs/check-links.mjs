#!/usr/bin/env node
// Checks relative markdown links in docs/, .claude/, CLAUDE.md and README.md. It only checks that the target
// file or folder exists (not anchors). A broken link listed in the baseline is accepted; a new broken link
// makes the command exit 1. Do not add entries for new links, fix the link (the one entry is in a vendored skill).
//
// Usage: node scripts/docs/check-links.mjs [--root <dir>] [--baseline <file>]
// Exit: 0 no new broken link | 1 new broken link | 2 usage or read error.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { repoFileIndex } from "./repo-files.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const SCAN_DIRS = ["docs", ".claude"];
const SCAN_FILES = ["CLAUDE.md", "README.md"];
const SKIP_DIRS = new Set(["node_modules", ".git"]);
const BASELINE_SEPARATOR = " -> ";

function parseArgs(argv) {
  const options = {
    root: resolve(scriptDir, "..", ".."),
    baseline: join(scriptDir, "link-baseline.txt"),
  };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if ((flag !== "--root" && flag !== "--baseline") || !value) {
      throw new Error("Usage: check-links.mjs [--root <dir>] [--baseline <file>]");
    }
    options[flag.slice(2)] = resolve(value);
  }
  return options;
}

// In a git work tree only tracked and untracked-but-not-ignored files are scanned (what a clean checkout
// has); elsewhere the filesystem is walked (test fixtures).
function collectMarkdownFiles(root, index) {
  if (index) {
    const inScope = (rel) =>
      rel.endsWith(".md") &&
      (SCAN_FILES.includes(rel) || SCAN_DIRS.some((dir) => rel.startsWith(`${dir}/`)));
    return index.files
      .filter((rel) => inScope(rel) && !rel.split("/").some((part) => SKIP_DIRS.has(part)))
      .sort()
      .map((rel) => join(root, rel));
  }
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(join(dir, entry.name));
      }
    }
  };
  for (const dir of SCAN_DIRS) {
    const full = join(root, dir);
    if (existsSync(full) && statSync(full).isDirectory()) walk(full);
  }
  for (const file of SCAN_FILES) {
    const full = join(root, file);
    if (existsSync(full)) files.push(full);
  }
  return files;
}

// Drops code fences and inline code so example links in documentation are not counted as real links.
function stripCode(text) {
  return text
    .replace(/^ {0,3}(```|~~~)[^\n]*\n[\s\S]*?(?:\n {0,3}\1[^\n]*(?=\n|$)|$)/gm, "")
    .replace(/(`+)[^`\n]*?\1/g, "");
}

// Reads the destination of an inline link starting right after "](": either <...> or a run without
// whitespace that allows nested parentheses and stops at an unmatched ")".
function readInlineDestination(text, start) {
  let index = start;
  while (/\s/.test(text[index] ?? "")) index += 1;
  if (text[index] === "<") {
    const close = text.indexOf(">", index);
    const newline = text.indexOf("\n", index);
    if (close === -1 || (newline !== -1 && newline < close)) return "";
    return text.slice(index + 1, close);
  }
  let depth = 0;
  const begin = index;
  for (; index < text.length; index += 1) {
    const char = text[index];
    if (/\s/.test(char)) break;
    if (char === "(") depth += 1;
    else if (char === ")") {
      if (depth === 0) break;
      depth -= 1;
    }
  }
  return text.slice(begin, index);
}

// Collects inline link destinations `[text](dest)` and reference definitions `[label]: dest "title"`.
// Every definition is checked, so full, collapsed and shortcut reference links are all covered.
export function extractTargets(text) {
  const targets = [];
  const stripped = stripCode(text);
  for (const match of stripped.matchAll(/\]\(/g)) {
    targets.push(readInlineDestination(stripped, match.index + match[0].length));
  }
  const definition = /^ {0,3}\[(?!\^)[^\]\n]+\]:[ \t]*\n?[ \t]*(<[^>\n]*>|\S+)/gm;
  for (const match of stripped.matchAll(definition)) {
    targets.push(match[1].replace(/^<|>$/g, ""));
  }
  return targets;
}

export function toLocalPath(target) {
  if (!target || target.startsWith("#") || target.startsWith("/")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return null;
  const withoutFragment = target.split(/[#?]/)[0];
  if (!withoutFragment) return null;
  try {
    return decodeURIComponent(withoutFragment);
  } catch {
    return withoutFragment;
  }
}

// Checks the case of every path segment so Windows and Linux give the same answer.
function existsExactCase(root, absolutePath) {
  if (!existsSync(absolutePath)) return false;
  const parts = relative(root, absolutePath).split(sep).filter(Boolean);
  if (parts[0] === "..") return true;
  let current = root;
  for (const part of parts) {
    if (part === "." || part === "..") {
      current = resolve(current, part);
      continue;
    }
    if (!readdirSync(current).includes(part)) return false;
    current = join(current, part);
  }
  return true;
}

// In a git work tree a target exists only when it is in the selected file set, so a link to an ignored
// folder is broken locally and on a clean checkout alike. Targets outside the root use the filesystem.
function targetExists(root, absolutePath, index) {
  if (!index) return existsExactCase(root, absolutePath);
  const rel = relative(root, absolutePath).split(sep).join("/");
  if (rel === ".." || rel.startsWith("../")) return existsSync(absolutePath);
  return index.has(rel) || index.hasDir(rel);
}

export function findBrokenLinks(root) {
  const broken = new Set();
  const index = repoFileIndex(root);
  for (const file of collectMarkdownFiles(root, index)) {
    const source = relative(root, file).split(sep).join("/");
    for (const target of extractTargets(readFileSync(file, "utf8"))) {
      const local = toLocalPath(target);
      if (local && !targetExists(root, resolve(dirname(file), local), index)) {
        broken.add(`${source}${BASELINE_SEPARATOR}${target}`);
      }
    }
  }
  return [...broken].sort();
}

function readBaseline(path) {
  return new Set(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  let baseline;
  try {
    baseline = readBaseline(options.baseline);
  } catch (error) {
    console.error(`Cannot read baseline ${options.baseline}: ${error.message}`);
    return 2;
  }
  const broken = findBrokenLinks(options.root);
  const unlisted = broken.filter((entry) => !baseline.has(entry));
  const accepted = broken.length - unlisted.length;
  const fixed = [...baseline].filter((entry) => !broken.includes(entry));

  for (const entry of unlisted) console.error(`NEW broken link: ${entry}`);
  for (const entry of fixed) console.log(`Baseline entry no longer broken (remove it): ${entry}`);
  console.log(`Broken links: ${broken.length} (${accepted} in baseline, ${unlisted.length} new).`);
  return unlisted.length > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
