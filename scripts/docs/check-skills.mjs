#!/usr/bin/env node
// Checks the shape of every project skill under .claude/skills/ against the required rules stated in the
// `skill-authoring` skill (Shape): SKILL.md exists, its frontmatter parses, `name` equals the folder, the
// description is not empty, the "Use when / do not use when" section exists and every file under
// references/ is linked from SKILL.md. The recommended conventions are not checked, and neither is whether a
// skill says the right thing.
//
// Usage: node scripts/docs/check-skills.mjs [--root <dir>]
// Exit: 0 no violations | 1 violations (`file:line [rule-id]` message on stderr) | 2 usage or read error.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { extractTargets, toLocalPath } from "./check-links.mjs";
import { repoFileIndex } from "./repo-files.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = ".claude/skills";
const SKIP_DIRS = new Set(["node_modules", ".git"]);
const USE_WHEN_HEADING = "## Use when / do not use when";

// Exceptions to the rules, one per path and rule, each with a reason (`skill-authoring`, Shape).
export const ALLOWLIST = [
  {
    file: ".claude/skills/playwright-cli/SKILL.md",
    rule: "skill-use-when",
    reason: "the vendored body keeps its layout; its DevSpace block carries \"Use when\" and \"Do not use when\"",
  },
];

function parseArgs(argv) {
  const options = { root: resolve(scriptDir, "..", "..") };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag !== "--root" || !value) {
      throw new Error("Usage: check-skills.mjs [--root <dir>]");
    }
    options.root = resolve(value);
  }
  return options;
}

// In a git work tree only tracked and untracked-but-not-ignored files are read (what a clean checkout
// has); elsewhere the filesystem is walked (test fixtures). Returns repo-relative paths under SKILLS_DIR.
function collectSkillFiles(root) {
  const index = repoFileIndex(root);
  if (index) {
    return index.files.filter((rel) => rel.startsWith(`${SKILLS_DIR}/`)).sort();
  }
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(rel);
      } else if (entry.isFile()) {
        found.push(rel);
      }
    }
  };
  const top = join(root, SKILLS_DIR);
  if (existsSync(top) && statSync(top).isDirectory()) walk(SKILLS_DIR);
  return found.sort();
}

// Marks the lines inside a code fence so headings and links shown as examples are not counted.
function markCode(lines) {
  let fence = null;
  return lines.map((text, index) => {
    const line = { n: index + 1, text, code: false };
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(text);
    if (fence) {
      line.code = true;
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length) fence = null;
    } else if (marker) {
      line.code = true;
      fence = { char: marker[1][0], length: marker[1].length };
    }
    return line;
  });
}

const KEY_VALUE = /^([a-z][a-z0-9-]*):(?:[ \t]+(.*))?$/;
const BLOCK_SCALAR = /^[|>][+-]?\d*$/;

// Reads the frontmatter block by the syntax in `skill-authoring` (Shape): single-line `key: value` lines, a
// value that starts with `"` is one double-quoted string without `"` or backslash inside. No YAML library.
function parseFrontmatter(lines, report) {
  if (lines[0]?.trimEnd() !== "---") {
    report(1, "skill-frontmatter", "SKILL.md must open with a --- frontmatter block");
    return null;
  }
  const close = lines.findIndex((text, index) => index > 0 && text.trimEnd() === "---");
  if (close === -1) {
    report(1, "skill-frontmatter", "the frontmatter block has no closing ---");
    return null;
  }
  const keys = new Map();
  for (let index = 1; index < close; index += 1) {
    const n = index + 1;
    const match = KEY_VALUE.exec(lines[index].trimEnd());
    if (!match) {
      report(n, "skill-frontmatter", "frontmatter line is not `key: value` with a key of [a-z][a-z0-9-]*");
      continue;
    }
    const [, key, rawValue = ""] = match;
    const value = rawValue.trim();
    if (keys.has(key)) {
      report(n, "skill-frontmatter", `frontmatter key "${key}" appears twice`);
      continue;
    }
    if (value.startsWith("'") || value.startsWith("[") || value.startsWith("{") || BLOCK_SCALAR.test(value)) {
      report(n, "skill-frontmatter", `the value of "${key}" must be a single-line plain or double-quoted string, not a flow list or map`);
      keys.set(key, { n, value: null });
      continue;
    }
    if (value.startsWith('"')) {
      const quoted = /^"([^"\\]*)"$/.exec(value);
      if (!quoted) {
        report(n, "skill-frontmatter", `the value of "${key}" must be one double-quoted string with no " or backslash inside`);
        keys.set(key, { n, value: null });
        continue;
      }
      keys.set(key, { n, value: quoted[1] });
      continue;
    }
    keys.set(key, { n, value });
  }
  return keys;
}

// Files the links of SKILL.md point to, read with the reader of `check-links.mjs` so both checks agree on
// destinations (code, angle brackets, nested parentheses, fragments).
function resolvedLinks(text, skillDir) {
  const resolved = new Set();
  for (const target of extractTargets(text)) {
    const local = toLocalPath(target);
    if (local) resolved.add(posix.join(skillDir, local));
  }
  return resolved;
}

export function checkSkills(root) {
  const violations = [];
  const files = collectSkillFiles(root).map((rel) => rel.split(sep).join("/"));
  const dirs = [...new Set(files.filter((rel) => rel.split("/").length > 3).map((rel) => rel.split("/")[2]))].sort();

  for (const dir of dirs) {
    const skillDir = `${SKILLS_DIR}/${dir}`;
    const skillRel = `${skillDir}/SKILL.md`;
    const report = (n, rule, message) => violations.push({ file: skillRel, line: n, rule, message });
    if (!files.includes(skillRel)) {
      report(1, "skill-file", `${skillDir} has no SKILL.md`);
      continue;
    }
    const text = readFileSync(join(root, skillRel), "utf8");
    const lines = text.split(/\r?\n/);
    const keys = parseFrontmatter(lines, report);
    if (keys) {
      const name = keys.get("name");
      if (!name) {
        report(1, "skill-name", "frontmatter has no name");
      } else if (name.value !== null && name.value !== dir) {
        report(name.n, "skill-name", `name "${name.value}" differs from the folder "${dir}"`);
      }
      const description = keys.get("description");
      if (!description) {
        report(1, "skill-description", "frontmatter has no description");
      } else if (description.value !== null && description.value.trim() === "") {
        report(description.n, "skill-description", "description is empty");
      }
    }
    const marked = markCode(lines);
    if (!marked.some((line) => !line.code && line.text.trimEnd() === USE_WHEN_HEADING)) {
      report(1, "skill-use-when", `no "${USE_WHEN_HEADING}" heading`);
    }
    const linked = resolvedLinks(text, skillDir);
    for (const rel of files.filter((file) => file.startsWith(`${skillDir}/references/`))) {
      if (!linked.has(rel)) {
        violations.push({ file: rel, line: 1, rule: "skill-reference-link", message: `${rel} is not linked from ${skillRel}` });
      }
    }
  }

  const allowed = (violation) =>
    ALLOWLIST.some((entry) => entry.file === violation.file && entry.rule === violation.rule);
  return violations
    .filter((violation) => !allowed(violation))
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    if (!existsSync(options.root) || !statSync(options.root).isDirectory()) {
      throw new Error(`Root is not a directory: ${options.root}`);
    }
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  let violations;
  try {
    violations = checkSkills(options.root);
  } catch (error) {
    console.error(`Cannot check skills: ${error.message}`);
    return 2;
  }
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
  }
  console.log(`Skill shape violations: ${violations.length}.`);
  return violations.length > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
