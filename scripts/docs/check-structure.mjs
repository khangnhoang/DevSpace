#!/usr/bin/env node
// Checks the shape of program documentation under docs/ against the mechanical rules stated in the
// `program-docs` skill and its templates: file roles, State only in progress.md, milestones, problems,
// future-features, the backlog, the Programs index and the ADR index. It does not judge whether a State
// is true or whether a translation kept its meaning.
//
// Usage: node scripts/docs/check-structure.mjs [--root <dir>]
// Exit: 0 no violations | 1 violations (`file:line [rule-id] message` on stderr) | 2 usage or read error.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { repoFileIndex } from "./repo-files.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = "docs";
const BACKLOG_DIR = "docs/backlog";
const PROGRAMS_DIR = "docs/programs";
const SKIP_DIRS = new Set(["node_modules", ".git"]);

// Exceptions to the rules, one per path and rule, each with a reason. A path that published migrations
// cite cannot move or be renumbered, so these two files keep their old shape (`program-docs` skill,
// migration procedure). Its progress.md gets no exemption.
export const ALLOWLIST = [
  {
    file: "docs/programs/security-hotfix/plan-h2.md",
    rule: "file-role",
    reason: "published migrations cite plan-h2.md section 4.1, so the second plan cannot move into implementation-plans/",
  },
  {
    file: "docs/programs/security-hotfix/problems.md",
    rule: "problems-shape",
    reason: "the P1-P29 table keeps its IDs and rows; translating it must not add, merge or drop a row",
  },
];

// Required fields of the State table in the progress template ("Hosted state" is optional).
const REQUIRED_STATE_FIELDS = [
  "Spec revision",
  "Current unit / checkpoint",
  "Status",
  "Completed evidence",
  "Accepted deviations",
  "Blockers / Owner decisions",
  "Next action",
  "Current authority",
];
const OPEN_ENTRY_FIELDS = ["Status", "Problem", "Evidence", "Direction", "Exit condition"];
const FEATURE_FIELDS = ["Status", "Direction", "Target program"];
const LIFECYCLES = new Set(["active", "closed"]);

// Milestone grammar from the progress template: `- YYYY-MM-DD <text> (<ref>)`, final period optional.
const HASH = "(?:`[0-9a-f]{7,40}`|[0-9a-f]{7,40})";
const MILESTONE_PATTERN = new RegExp(
  `^[-*+] \\d{4}-\\d{2}-\\d{2} .+ \\((${HASH}|PR \\d+|PR \\d+, ${HASH}|this commit)\\)\\.?$`,
);
const ID = "[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\\d+";
const ID_PATTERN = new RegExp(`\\b(${ID})\\b`);
const FEATURE_HEADING = /^(FEAT-\d+): \S/;
// A closed backlog entry is exactly one line that keeps its ID (program-docs skill, Backlog).
const closedPattern = (idPattern) =>
  new RegExp(`^[-*+] (${idPattern}) — (?:Done: .+ \\(PR #\\d+\\)|Moved to \\[[^\\]]+\\]\\([^)]+\\)|Dropped: .+)$`);
const CLOSED_PATTERN = closedPattern(ID);
const FEATURE_CLOSED_PATTERN = closedPattern("FEAT-\\d+");
// A resolved problem is one list line that starts with its ID and an em dash.
const RESOLVED_PATTERN = new RegExp(`^[-*+]\\s+\\**(${ID})\\**\\s+— \\S`);

function parseArgs(argv) {
  const options = { root: resolve(scriptDir, "..", "..") };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag !== "--root" || !value) {
      throw new Error("Usage: check-structure.mjs [--root <dir>]");
    }
    options.root = resolve(value);
  }
  return options;
}

// In a git work tree only tracked and untracked-but-not-ignored files are read (what a clean checkout
// has); elsewhere the filesystem is walked (test fixtures).
function collectDocsFiles(root, docsRoot) {
  const index = repoFileIndex(root);
  if (!index) return collectMarkdownFiles(docsRoot);
  return index.files
    .filter((rel) => rel.startsWith(`${DOCS_DIR}/`) && rel.endsWith(".md"))
    .filter((rel) => !rel.split("/").some((part) => SKIP_DIRS.has(part)))
    .sort()
    .map((rel) => join(root, rel));
}

function collectMarkdownFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectMarkdownFiles(join(dir, entry.name), found);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

// Splits a file into lines and marks the ones inside YAML front matter or a code fence, so headings and
// list items shown as examples in code are not counted as content.
function parseDocument(rel, text) {
  const raw = text.split(/\r?\n/);
  let frontMatterEnd = -1;
  if (raw[0]?.trim() === "---") {
    const close = raw.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (close !== -1) frontMatterEnd = close;
  }
  let fence = null;
  const lines = raw.map((content, index) => {
    const line = { n: index + 1, text: content, frontMatter: index <= frontMatterEnd, code: false };
    if (line.frontMatter) return line;
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(content);
    if (fence) {
      line.code = true;
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length) fence = null;
    } else if (marker) {
      line.code = true;
      fence = { char: marker[1][0], length: marker[1].length };
    }
    return line;
  });
  const content = lines.filter((line) => !line.frontMatter && !line.code);
  const headings = content
    .map((line) => {
      const match = /^(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/.exec(line.text);
      return match ? { n: line.n, level: match[1].length, title: match[2].trim() } : null;
    })
    .filter(Boolean);
  return { rel, lines, content, headings };
}

// Reference definition: `[label]: destination "title"`. By CommonMark the destination may sit on the next
// line and the title on the one after. A definition line is not a link; only a place that uses it is.
const DEFINITION_START = /^ {0,3}\[(?!\^)([^\]\n]+)\]:[ \t]*(.*)$/;
const TITLE_LINE = /^[ \t]*(?:"[^"]*"|'[^']*'|\([^)]*\))[ \t]*$/;
const normalizeLabel = (label) => label.trim().replace(/\s+/g, " ").toLowerCase();

function destinationOf(text) {
  const match = /^(<[^>\n]*>|\S+)(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/.exec(text.trim());
  if (!match) return null;
  return { destination: match[1].replace(/^<|>$/g, ""), titled: match[0].length > match[1].length };
}

// Label -> destination table, plus the set of line numbers that belong to a definition.
function parseDefinitions(contentLines) {
  const map = new Map();
  const lines = new Set();
  for (let index = 0; index < contentLines.length; index += 1) {
    const line = contentLines[index];
    const start = DEFINITION_START.exec(line.text);
    if (!start) continue;
    let parsed = destinationOf(start[2]);
    let last = index;
    if (start[2].trim() === "") {
      const next = contentLines[index + 1];
      if (!next || next.n !== line.n + 1 || next.text.trim() === "") continue;
      parsed = destinationOf(next.text);
      if (!parsed) continue;
      last = index + 1;
    } else if (parsed === null) {
      continue;
    }
    const { destination, titled } = parsed;
    const title = contentLines[last + 1];
    if (
      !titled &&
      title &&
      title.n === contentLines[last].n + 1 &&
      TITLE_LINE.test(title.text) &&
      !DEFINITION_START.test(title.text)
    ) {
      last += 1;
    }
    for (let at = index; at <= last; at += 1) lines.add(contentLines[at].n);
    const label = normalizeLabel(start[1]);
    if (!map.has(label)) map.set(label, destination);
    index = last;
  }
  return { map, lines };
}

// Destinations of the links used on one content line: inline `[t](d)` and reference `[t][label]`,
// `[label][]`, `[label]` looked up in `definitions.map`. A definition line itself holds no link.
function linkTargets(line, definitions) {
  if (definitions?.lines.has(line.n)) return [];
  const stripped = line.text.replace(/(`+)[^`\n]*?\1/g, "");
  const targets = [...stripped.matchAll(/\]\(<?([^)>\s]+)/g)].map((match) => match[1]);
  if (!definitions) return targets;
  const withoutInline = stripped.replace(/\]\([^)]*\)/g, "]");
  for (const match of withoutInline.matchAll(/\[([^\]\n]*)\](?:\[([^\]\n]*)\])?(?!:)/g)) {
    const label = match[2] === undefined || match[2] === "" ? match[1] : match[2];
    const target = definitions.map.get(normalizeLabel(label));
    if (target) targets.push(target);
  }
  return targets;
}

// A link counts only when it resolves to the program's own progress.md (fragment and query dropped), so
// `progress.md.bak` and another program's progress.md do not count.
function pointsToOwnProgress(target, docRel, programDir) {
  const path = target.split(/[#?]/)[0];
  if (path === "" || path.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(path)) return false;
  return posix.join(posix.dirname(docRel), path) === `${programDir}/progress.md`;
}

function sectionRange(doc, heading, level) {
  const next = doc.headings.find((item) => item.n > heading.n && item.level <= level);
  return { from: heading.n, to: next ? next.n : Infinity };
}

function sectionLines(doc, heading, level) {
  const range = sectionRange(doc, heading, level);
  return doc.content.filter((line) => line.n > range.from && line.n < range.to);
}

function hasField(body, field) {
  return body.some((line) => new RegExp(`^\\s*[-*]\\s+\\**${field}:`).test(line.text));
}

function checkProgress(doc, report) {
  const h2 = doc.headings.filter((heading) => heading.level === 2);
  const names = h2.map((heading) => heading.title);
  if (names.length !== 2 || names[0] !== "State" || names[1] !== "Milestones") {
    const found = names.length ? names.join(", ") : "none";
    report(
      h2[2]?.n ?? h2[0]?.n ?? 1,
      "progress-state",
      `progress.md must have exactly two "##" headings, State then Milestones; found: ${found}`,
    );
  }

  const state = h2.find((heading) => heading.title === "State");
  if (state) {
    const fields = new Set();
    for (const line of sectionLines(doc, state, 2)) {
      const row = /^\s*\|([^|]*)\|/.exec(line.text);
      if (row) fields.add(row[1].trim());
    }
    for (const field of REQUIRED_STATE_FIELDS) {
      if (!fields.has(field)) {
        report(state.n, "progress-state", `State table is missing the field "${field}"`);
      }
    }
  }

  const milestones = h2.find((heading) => heading.title === "Milestones");
  if (!milestones) return;
  const items = [];
  let current = null;
  for (const line of sectionLines(doc, milestones, 2)) {
    if (line.text.trim() === "") {
      current = null;
    } else if (/^[-*+] /.test(line.text)) {
      current = { n: line.n, text: line.text.trimEnd() };
      items.push(current);
    } else if (current) {
      report(line.n, "milestone-format", "a milestone must be one line; do not wrap it onto another line");
    }
  }
  const refs = [];
  for (const item of items) {
    const match = MILESTONE_PATTERN.exec(item.text);
    if (!match) {
      report(
        item.n,
        "milestone-format",
        "milestone must match `- YYYY-MM-DD <text> (<short hash> | PR <n> | PR <n>, <hash> | this commit)`",
      );
    }
    refs.push(match?.[1] ?? null);
  }
  const thisCommit = refs.flatMap((ref, index) => (ref === "this commit" ? [index] : []));
  if (thisCommit.length > 1) {
    report(items[thisCommit[1]].n, "this-commit", 'at most one milestone may cite "(this commit)"');
  } else if (thisCommit.length === 1 && thisCommit[0] !== items.length - 1) {
    report(items[thisCommit[0]].n, "this-commit", 'the "(this commit)" milestone must be the last one');
  }
}

// An entry declaration is a line that starts with an ID followed by `:` or an em dash (`- BL-001: ...`,
// `- BL-001 — Done: ...`). It is valid only in the closing section (`Resolved`, `Closed`), where each line is
// checked; anywhere else, including after a complete entry, it would never be checked, so it is reported.
// A reference (`Plan: [ALPHA-001](plan.md)`, prose that mentions an ID) is not a declaration.
const DECLARATION = new RegExp(`^\\s*(?:[-*+]\\s+)?\\**(${ID})\\**\\s*(?::|—)`);
function reportDeclarations(doc, report, rule, closingTitle) {
  const closing = doc.headings.find((heading) => heading.level === 2 && heading.title === closingTitle);
  const range = closing ? sectionRange(doc, closing, 2) : null;
  for (const line of doc.content) {
    if (range && line.n >= range.from && line.n < range.to) continue;
    const id = DECLARATION.exec(line.text)?.[1];
    if (id) report(line.n, rule, `${id} is declared outside a valid entry; use an entry heading or move it under "## ${closingTitle}"`);
  }
}

// `backlog` switches the Resolved section to the three closed forms of the backlog (Done, Moved to, Dropped).
function checkProblems(doc, report, { backlog = false } = {}) {
  const h2 = doc.headings.filter((heading) => heading.level === 2);
  const open = h2.find((heading) => heading.title === "Open");
  const resolved = h2.find((heading) => heading.title === "Resolved");
  if (!open) report(1, "problems-shape", 'problems.md is missing the "## Open" section');
  if (!resolved) report(1, "problems-shape", 'problems.md is missing the "## Resolved" section');

  const seen = new Map();
  const noteId = (id, n) => {
    if (seen.has(id)) {
      report(n, "problems-shape", `ID ${id} is not unique (first used at line ${seen.get(id)})`);
    } else {
      seen.set(id, n);
    }
  };

  reportDeclarations(doc, report, "problems-shape", "Resolved");

  if (open) {
    const range = sectionRange(doc, open, 2);
    const entries = doc.headings.filter(
      (heading) => heading.level === 3 && heading.n > range.from && heading.n < range.to,
    );
    for (const entry of entries) {
      const id = ID_PATTERN.exec(entry.title)?.[1];
      if (id) noteId(id, entry.n);
      else report(entry.n, "problems-shape", "open entry heading has no ID such as `PREFIX-001`");
      const body = sectionLines(doc, entry, 3);
      for (const field of OPEN_ENTRY_FIELDS) {
        if (!hasField(body, field)) {
          report(entry.n, "problems-shape", `open entry ${id ?? entry.title} is missing "${field}"`);
        }
      }
    }
  }

  if (resolved) {
    let started = false;
    let intro = false;
    for (const line of sectionLines(doc, resolved, 2)) {
      if (line.text.trim() === "") continue;
      if (/^[-*+] /.test(line.text)) {
        started = true;
        const id = RESOLVED_PATTERN.exec(line.text)?.[1];
        if (id) noteId(id, line.n);
        else report(line.n, "problems-shape", "a resolved entry must start with its ID and an em dash, such as `- PREFIX-001 — ...`");
        if (backlog && !CLOSED_PATTERN.test(line.text.trimEnd())) {
          report(
            line.n,
            "problems-shape",
            "a closed backlog entry must be `<ID> — Done: <how> (PR #n)`, `<ID> — Moved to [<program>](<link>)` or `<ID> — Dropped: <reason>`",
          );
        }
      } else if (!started && !intro && /^One line each\b/.test(line.text)) {
        intro = true;
      } else {
        report(
          line.n,
          "problems-shape",
          'Resolved holds only one-line list entries after the template intro "One line each ..."; this line must be one list line',
        );
      }
    }
  }
}

// `seenIds` is shared by every future-features file, so a FEAT ID is unique across the whole repository.
// A `Moved to` line points at the entry's new home instead of declaring it, so it goes to `moved` and is
// checked after every file has been read.
function checkFutureFeatures(doc, report, seenIds, moved) {
  const noteId = (id, n) => {
    const first = seenIds.get(id);
    if (first) {
      report(n, "future-features-shape", `ID ${id} is not unique (first used at ${first.file}:${first.n})`);
    } else {
      seenIds.set(id, { file: doc.rel, n });
    }
  };
  const h2 = doc.headings.filter((item) => item.level === 2);
  reportDeclarations(doc, report, "future-features-shape", "Closed");
  for (const heading of h2) {
    if (heading.title === "Closed") {
      for (const line of sectionLines(doc, heading, 2)) {
        if (line.text.trim() === "") continue;
        const closed = FEATURE_CLOSED_PATTERN.exec(line.text.trimEnd());
        if (closed && line.text.includes(" — Moved to [")) {
          moved.push({ id: closed[1], n: line.n, report });
        } else if (closed) {
          noteId(closed[1], line.n);
        } else {
          report(
            line.n,
            "future-features-shape",
            "a closed entry must be `- FEAT-NNN — Done: <how> (PR #n)`, `... — Moved to [<program>](<link>)` or `... — Dropped: <reason>`",
          );
        }
      }
      continue;
    }
    const id = FEATURE_HEADING.exec(heading.title)?.[1];
    if (!id) {
      report(heading.n, "future-features-shape", 'entry heading must be "## FEAT-NNN: <title>" (closed entries go under "## Closed")');
      continue;
    }
    noteId(id, heading.n);
    const body = sectionLines(doc, heading, 2);
    for (const field of FEATURE_FIELDS) {
      if (!hasField(body, field)) {
        report(heading.n, "future-features-shape", `entry ${id} is missing "${field}"`);
      }
    }
  }
}

function checkPlan(doc, kind, report, programDir) {
  const isOwnProgress = (target) => pointsToOwnProgress(target, doc.rel, programDir);
  const definitions = parseDefinitions(doc.content);
  for (const heading of doc.headings) {
    const title = heading.title.replace(/^\d+(?:\.\d+)*\.?\s+/, "").toLowerCase();
    if (title !== "state" && title !== "current state") continue;
    const body = sectionLines(doc, heading, heading.level).filter(
      (line) => line.text.trim() !== "" && !definitions.lines.has(line.n),
    );
    const isPointer =
      body.length === 1 && linkTargets(body[0], definitions).some(isOwnProgress);
    if (!isPointer) {
      report(
        heading.n,
        "no-state-in-plan",
        `plan has a "${heading.title}" section; State lives only in progress.md (a one-line pointer is allowed)`,
      );
    }
  }
  if (kind === "detail") {
    const linksProgress = doc.content.some((line) =>
      linkTargets(line, definitions).some(isOwnProgress),
    );
    if (!linksProgress) report(1, "plan-progress-link", "a detail plan must link to its own program's progress.md with a Markdown link");
  }
}

// Role of a file inside a program, from its path relative to the program folder. A root plan.md is a
// master plan when the program has implementation-plans/, otherwise a detail plan (single-unit program).
function roleOf(relInProgram, hasUnits) {
  if (relInProgram === "plan.md") return hasUnits ? "master" : "detail";
  if (relInProgram === "progress.md" || relInProgram === "problems.md") return relInProgram.slice(0, -3);
  if (relInProgram === "future-features.md") return "future";
  if (/^implementation-plans\/[^/]+\/plan\.md$/.test(relInProgram)) return "detail";
  return null;
}

function parseProgramsTable(readme, report) {
  const heading = readme.headings.find((item) => item.level === 2 && item.title === "Programs");
  if (!heading) {
    report("docs/README.md", 1, "programs-index", 'docs/README.md has no "## Programs" section');
    return { rows: [], line: 1 };
  }
  const rows = [];
  let pathColumn = -1;
  let lifecycleColumn = -1;
  for (const line of sectionLines(readme, heading, 2)) {
    if (!/^\s*\|/.test(line.text)) continue;
    const cells = line.text.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
    if (pathColumn === -1) {
      pathColumn = cells.findIndex((cell) => cell.toLowerCase() === "path");
      lifecycleColumn = cells.findIndex((cell) => cell.toLowerCase() === "lifecycle");
      if (pathColumn === -1 || lifecycleColumn === -1) {
        report("docs/README.md", line.n, "programs-index", "Programs table needs Path and Lifecycle columns");
        return { rows, line: heading.n };
      }
      continue;
    }
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    const path = (cells[pathColumn] ?? "").replace(/`/g, "").replace(/\/+$/, "");
    const lifecycle = (cells[lifecycleColumn] ?? "").replace(/[`*]/g, "").toLowerCase();
    rows.push({ n: line.n, path: posix.join(DOCS_DIR, path), lifecycle });
  }
  return { rows, line: heading.n };
}

export function checkStructure(root) {
  const violations = [];
  const docsRoot = join(root, DOCS_DIR);
  if (!existsSync(docsRoot) || !statSync(docsRoot).isDirectory()) return violations;

  const docs = new Map();
  for (const file of collectDocsFiles(root, docsRoot)) {
    const rel = relative(root, file).split(sep).join("/");
    docs.set(rel, parseDocument(rel, readFileSync(file, "utf8")));
  }
  const reportFor = (rel) => (n, rule, message) => violations.push({ file: rel, line: n, rule, message });

  // A program is a folder directly under docs/programs/ with a progress.md. The backlog is not a program, and
  // a progress.md anywhere else is not subject to program rules.
  const programDirs = [...docs.keys()]
    .filter((rel) => posix.basename(rel) === "progress.md")
    .map((rel) => posix.dirname(rel))
    .filter((dir) => posix.dirname(dir) === PROGRAMS_DIR);
  const programOf = (rel) =>
    programDirs.filter((dir) => rel.startsWith(`${dir}/`)).sort((a, b) => b.length - a.length)[0];
  const featureIds = new Map();
  const movedFeatures = [];

  for (const doc of docs.values()) {
    const dir = programOf(doc.rel);
    if (!dir) continue;
    const report = reportFor(doc.rel);
    const relInProgram = doc.rel.slice(dir.length + 1);
    const hasUnits = [...docs.keys()].some((rel) => rel.startsWith(`${dir}/implementation-plans/`));
    const role = roleOf(relInProgram, hasUnits);
    if (!role) {
      report(
        1,
        "file-role",
        "file is not a program role (plan, progress, problems, future-features, implementation-plans/<unit>/plan.md); remove it or move its content",
      );
    } else if (role === "progress") {
      checkProgress(doc, report);
    } else if (role === "problems") {
      checkProblems(doc, report);
    } else if (role !== "future") {
      checkPlan(doc, role, report, dir);
    }
  }

  // Every future-features.md under docs/ is checked exactly once, wherever it sits, so FEAT IDs are unique
  // across the whole repository.
  for (const doc of docs.values()) {
    if (posix.basename(doc.rel) === "future-features.md") {
      checkFutureFeatures(doc, reportFor(doc.rel), featureIds, movedFeatures);
    }
  }
  const movedOnce = new Set();
  for (const { id, n, report } of movedFeatures) {
    if (!featureIds.has(id)) {
      report(n, "future-features-shape", `${id} is marked moved, but no future-features.md holds its entry`);
    } else if (movedOnce.has(id)) {
      report(n, "future-features-shape", `${id} is marked moved more than once`);
    }
    movedOnce.add(id);
  }

  for (const doc of docs.values()) {
    if (!doc.rel.startsWith(`${BACKLOG_DIR}/`)) continue;
    const report = reportFor(doc.rel);
    const name = doc.rel.slice(BACKLOG_DIR.length + 1);
    if (name === "progress.md" || name === "plan.md") {
      report(1, "backlog-not-program", "docs/backlog/ is not a program: it has no plan.md and no progress.md");
    } else if (name === "problems.md") {
      checkProblems(doc, report, { backlog: true });
    } else if (name !== "future-features.md") {
      report(1, "backlog-shape", "docs/backlog/ holds only future-features.md and problems.md");
    }
  }

  const readme = docs.get("docs/README.md");
  if (readme) {
    const report = (file, n, rule, message) => reportFor(file)(n, rule, message);
    const { rows, line } = parseProgramsTable(readme, report);
    const byPath = new Map();
    for (const row of rows) {
      if (row.path === BACKLOG_DIR) {
        report("docs/README.md", row.n, "backlog-not-program", "docs/backlog/ is not a program and has no Programs row");
        continue;
      }
      if (byPath.has(row.path)) {
        report("docs/README.md", row.n, "programs-index", `program ${row.path} has more than one row`);
      }
      byPath.set(row.path, row);
      if (!programDirs.includes(row.path)) {
        report("docs/README.md", row.n, "programs-index", `row ${row.path} does not point to a program (a folder with progress.md)`);
      }
      if (!LIFECYCLES.has(row.lifecycle)) {
        report("docs/README.md", row.n, "programs-index", `lifecycle "${row.lifecycle}" must be active or closed`);
      }
    }
    for (const dir of programDirs) {
      if (!byPath.has(dir)) {
        report("docs/README.md", line, "programs-index", `program ${dir} has no row in the Programs table`);
      }
    }
  } else if (programDirs.length > 0) {
    reportFor("docs/README.md")(1, "programs-index", "docs/README.md is missing, so programs have no index");
  }

  const adrFiles = [...docs.keys()].filter(
    (rel) => posix.dirname(rel) === "docs/adr" && posix.basename(rel) !== "README.md",
  );
  if (adrFiles.length > 0) {
    const adrReadme = docs.get("docs/adr/README.md");
    const adrDefinitions = parseDefinitions(adrReadme?.content ?? []);
    const linked = new Set(
      (adrReadme?.content ?? []).flatMap((line) =>
        linkTargets(line, adrDefinitions).map((target) => posix.normalize(posix.join("docs/adr", target.split(/[#?]/)[0]))),
      ),
    );
    for (const rel of adrFiles) {
      if (!linked.has(rel)) {
        reportFor(adrReadme ? "docs/adr/README.md" : rel)(1, "adr-index", `${rel} is not linked from docs/adr/README.md`);
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
    violations = checkStructure(options.root);
  } catch (error) {
    console.error(`Cannot check docs structure: ${error.message}`);
    return 2;
  }
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
  }
  console.log(`Docs structure violations: ${violations.length}.`);
  return violations.length > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
