// Test plan:
// - Goal: check that the structure checker blocks only the shape rules stated in the `program-docs` skill and
//   passes docs that follow its templates.
// - Type: Node CLI black-box tests on temporary fixture trees built from the skill's templates.
// - Subject: `scripts/docs/check-structure.mjs`.
// - Passing cases: a tree that follows the templates exits 0; every rule ID has a passing fixture next to its
//   failing one; the security-hotfix allowlist retains only the two historical plan path/rule pairs.
// - Failing cases: loose IDs outside a valid entry, a closed future-features line with the wrong prefix, a
//   duplicate FEAT ID in a file outside programs and backlog, a plan that links another program's progress.md,
//   a progress.md outside docs/programs not treated as a program; every rule ID (file-role, progress-state, milestone-format, this-commit, problems-shape,
//   no-state-in-plan, plan-progress-link, plan-shape, future-features-shape, backlog-shape, backlog-not-program,
//   programs-index, adr-index) has a fixture that exits 1 and names the right `file:line [rule-id]`; the
//   allowlist is per path and per rule; bad usage or a missing root exits 2.
// - Evergreen programs: the Programs lifecycle `evergreen` selects a charter README.md (title, five sections,
//   Initiatives table) and initiative plans checked against that table; a root plan.md, a missing charter, a bad
//   title, sections, IDs and a README.md in a delivery program each fail with the right rule.
// - Entry plans: a delivery program's `implementation-plans/<id>-<slug>/plan.md` passes when its ID is an open,
//   resolved, Done or Dropped entry of that program's own problems.md or future-features.md; another program's
//   entry, a `Moved` line, a title or folder mismatch, an uppercase or slugless folder, an evergreen program
//   and a root detail plan each fail.
// - Invariant: CLI behavior depends only on the fixture tree; the inventory regression also checks the
//   repository's identifier registries and canonical security problem declarations.
// - Last verified with: `npm run docs:check:test`.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { ALLOWLIST } from "./check-structure.mjs";
import { legacyDeclarations, nextIdentifier } from "./work-identifiers.mjs";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./check-structure.mjs", import.meta.url));

const STATE_ROWS = [
  "Spec revision",
  "Current unit / checkpoint",
  "Status",
  "Completed evidence",
  "Accepted deviations",
  "Blockers / Owner decisions",
  "Next action",
  "Current authority",
];

function progress({ fields = STATE_ROWS, milestones = ["- 2026-01-01 Started (abc1234)."], extra = "" } = {}) {
  return [
    "# Progress — Alpha",
    "",
    "Plan: [plan.md](plan.md). Problems: [problems.md](problems.md).",
    "",
    "## State",
    "",
    "| Field | Value |",
    "| --- | --- |",
    ...fields.map((field) => `| ${field} | value |`),
    "",
    extra,
    "## Milestones",
    "",
    "One line each, newest last.",
    "",
    ...milestones,
    "",
  ].join("\n");
}

function problems(open, resolved) {
  return [
    "# Problems — Alpha",
    "",
    "## Open",
    "",
    open,
    "",
    "## Resolved",
    "",
    "One line each.",
    "",
    resolved,
    "",
  ].join("\n");
}

const OPEN_ENTRY = (id, status = "Open (2026-01-01)") =>
  [
    `### ${id}: Something`,
    "",
    `- Status: ${status}.`,
    "- Problem: p.",
    "- Evidence: e.",
    "- Direction: d.",
    "- Exit condition: x.",
  ].join("\n");

const FEATURE = (id, extra = "") =>
  [`## ${id}: Something`, "", "- Status: Deferred.", "- Direction: d.", "- Target program: none yet.", extra, ""].join("\n");

const README = (rows) => {
  const codes = { alpha: "AL", solo: "SO", gamma: "GA", beta: "BE", "security-hotfix": "SH", other: "OT", ghost: "GH" };
  return ["# Docs", "", "## Programs", "", "| Path | Code | Lifecycle |", "| --- | --- | --- |", ...rows.map(row => row.replace(/(programs\/([a-z-]+)\/?`? \|)/, (cell, path, name) => cell + " " + (codes[name] ?? "XX") + " |")), ""].join("\n");
};

const DETAIL_SECTIONS = ["1. Binding Spec", "2. Repository facts", "3. Bounded implementation hypotheses", "4. Checkpoints", "5. Risks, rollout and rollback", "6. Progress"];
const MASTER_SECTIONS = ["1. Goal and outcome", "2. Owner decisions", "3. Shared invariants", "4. Units", "5. Order and rollout gates", "6. Program risks", "7. Out of scope"];
const sections = (titles) => titles.map((title) => `## ${title}\n`).join("\n");
const DETAIL = `# SO-U1 detail plan — one unit\n\n${sections(DETAIL_SECTIONS)}\nCurrent State and milestones: [progress.md](progress.md).\n`;
const UNIT_DETAIL = DETAIL.replace("# SO-U1 detail plan", "# AL-U1 detail plan").replace("(progress.md)", "(../../progress.md)");
const UNIT_PATH = "docs/programs/alpha/implementation-plans/al-u1-first/plan.md";
const UNITS_TABLE = "| Unit | Branch |\n| --- | --- |\n| AL-U1 First | `b1` |\n";
const LEGACY_PLAN = legacyDeclarations.find(e => e.role === "legacy-plan" && e.file.endsWith("/plan.md")).form + "\n\n## 1. Background\n\nProgress: [progress.md](progress.md).\n";
const MASTER = `# Master plan — Alpha\n\n${sections(MASTER_SECTIONS).replace("## 4. Units\n", `## 4. Units\n\n${UNITS_TABLE}`)}`;

const CHARTER_SECTIONS = ["1. Capability and boundary", "2. Owner decisions", "3. Invariants", "4. Initiatives", "5. Opening an initiative"];
const INITIATIVES_TABLE = "| Initiative | Branch |\n| --- | --- |\n| GA-U1 First | `b1` |\n";
const CHARTER = `# Charter — Gamma\n\n${sections(CHARTER_SECTIONS).replace("## 4. Initiatives\n", `## 4. Initiatives\n\n${INITIATIVES_TABLE}`)}`;
const GAMMA = "docs/programs/gamma";
const GAMMA_UNIT_PATH = `${GAMMA}/implementation-plans/ga-u1-first/plan.md`;

// An evergreen program next to the base tree's alpha (master plan) and solo (single-unit) programs; the
// Programs table is replaced with one that lists it.
function evergreenTree() {
  return {
    "docs/README.md": README(["| `programs/alpha` | active |", "| `programs/solo` | closed |", "| `programs/gamma` | evergreen |"]),
    [`${GAMMA}/README.md`]: CHARTER,
    [`${GAMMA}/progress.md`]: progress(),
    [`${GAMMA}/problems.md`]: problems(OPEN_ENTRY("GA-P1"), "- GA-P9 — Resolved 2026-01-01: done (abc1234)."),
    [GAMMA_UNIT_PATH]: UNIT_DETAIL.replaceAll("AL-U1", "GA-U1"),
  };
}

function baseTree() {
  return {
    "docs/README.md": README(["| `programs/alpha` | active |", "| `programs/solo` | closed |"]),
    "docs/programs/alpha/plan.md": MASTER,
    "docs/programs/alpha/progress.md": progress(),
    "docs/programs/alpha/problems.md": problems(OPEN_ENTRY("AL-P1"), "- AL-P9 — Resolved 2026-01-01: done (abc1234)."),
    [UNIT_PATH]: UNIT_DETAIL,
    "docs/programs/alpha/future-features.md": `# Future\n\n${FEATURE("AL-F10")}`,
    "docs/programs/solo/plan.md": DETAIL,
    "docs/programs/solo/progress.md": progress(),
    "docs/programs/solo/problems.md": problems(OPEN_ENTRY("SO-P1"), "- SO-P9 — Resolved 2026-01-01: done (abc1234)."),
    "docs/backlog/future-features.md": `# Backlog features\n\n${FEATURE("BL-F1")}\n## Closed\n\n- BL-F2 — Dropped: not needed.\n`,
    "docs/backlog/problems.md": problems(
      OPEN_ENTRY("BL-P1", "Fixed locally, awaiting delivery"),
      "- BL-P2 — Done: fixed the copy (PR #7)\n- BL-P3 — Moved to [solo](../programs/solo/problems.md)\n- BL-P4 — Dropped: duplicate",
    ),
    "docs/adr/README.md": "# ADRs\n\n- [one](one.md)\n",
    "docs/adr/one.md": "# One\n",
    "scripts/docs/work-id-mappings.json": JSON.stringify([{from:{file:"docs/backlog/problems.md",id:"BL-P3"},to:{file:"docs/programs/solo/problems.md",id:"SO-P9"}}]),
  };
}

function run(overrides = {}) {
  const files = { ...baseTree(), ...overrides };
  const root = mkdtempSync(join(tmpdir(), "check-structure-"));
  try {
    for (const [path, content] of Object.entries(files)) {
      if (content === null) continue;
      const full = join(root, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
    const result = spawnSync(process.execPath, [scriptPath, "--root", root], { encoding: "utf8" });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function assertViolation(result, file, rule, line) {
  assert.equal(result.status, 1, result.stderr);
  const escaped = file.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}:${line ?? "\\d+"} \\[${rule}\\] `, "m");
  assert.match(result.stderr, pattern);
}

function assertClean(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Docs structure violations: 0\./);
}

test("a tree that follows the templates exits 0", () => {
  assertClean(run());
});

test("file-role: a non-role file in a program fails, role files pass", () => {
  assertViolation(run({ "docs/programs/alpha/notes.md": "# Notes\n" }), "docs/programs/alpha/notes.md", "file-role", 1);
  assertViolation(run({ "docs/programs/alpha/sources/input.md": "# Source\n" }), "docs/programs/alpha/sources/input.md", "file-role", 1);
  assertClean(run({ "docs/other/loose.md": "# Not in a program\n" }));
});

test("a program is a folder directly under docs/programs; elsewhere progress.md is not a program", () => {
  const outside = {
    "docs/legacy/x/progress.md": "# Not a program\n",
    "docs/legacy/x/plan.md": "# Loose plan\n",
    "docs/legacy/x/notes.md": "# Notes\n",
  };
  assertClean(run(outside));
  assertViolation(
    run({ ...outside, "docs/README.md": README(["| `programs/alpha` | active |", "| `programs/solo` | closed |", "| `legacy/x` | active |"]) }),
    "docs/README.md",
    "programs-index",
  );
  assertViolation(
    run({ "docs/programs/alpha/implementation-plans/al-u1/progress.md": progress() }),
    "docs/programs/alpha/implementation-plans/al-u1/progress.md",
    "file-role",
    1,
  );
});

test("progress-state: only State then Milestones, with every required State field", () => {
  assertViolation(
    run({ "docs/programs/alpha/progress.md": progress().replace("## Milestones", "## Notes\n\n## Milestones") }),
    "docs/programs/alpha/progress.md",
    "progress-state",
  );
  assertViolation(
    run({ "docs/programs/alpha/progress.md": progress({ fields: STATE_ROWS.slice(1) }) }),
    "docs/programs/alpha/progress.md",
    "progress-state",
    5,
  );
  assertClean(run({ "docs/programs/alpha/progress.md": progress({ fields: [...STATE_ROWS, "Hosted state"] }) }));
  assertClean(run({ "docs/programs/alpha/progress.md": progress({ extra: "### State transitions\n\nText.\n" }) }));
});

test("milestone-format: date, text and a final reference in the stated grammar", () => {
  const bad = (line) =>
    assertViolation(
      run({ "docs/programs/alpha/progress.md": progress({ milestones: [line] }) }),
      "docs/programs/alpha/progress.md",
      "milestone-format",
    );
  bad("- Started (abc1234).");
  bad("- 2026-01-01 Started.");
  bad("- 2026-01-01 Started (abc12).");
  for (const ok of [
    "- 2026-01-01 Started (abc1234).",
    "- 2026-01-01 Started (`abc1234`)",
    "- 2026-01-01 Merged (PR 12)",
    "- 2026-01-01 Merged (PR 12, abc1234).",
    "- 2026-01-01 Done (this commit).",
  ]) {
    assertClean(run({ "docs/programs/alpha/progress.md": progress({ milestones: [ok] }) }));
  }
  assertViolation(
    run({ "docs/programs/alpha/progress.md": progress({ milestones: ["- 2026-01-01 Started (abc1234)", "  continued here"] }) }),
    "docs/programs/alpha/progress.md",
    "milestone-format",
  );
});

test("this-commit: at most one, and it must be the last milestone", () => {
  const two = progress({ milestones: ["- 2026-01-01 A (this commit).", "- 2026-01-02 B (this commit)."] });
  assertViolation(run({ "docs/programs/alpha/progress.md": two }), "docs/programs/alpha/progress.md", "this-commit");
  const notLast = progress({ milestones: ["- 2026-01-01 A (this commit).", "- 2026-01-02 B (abc1234)."] });
  assertViolation(run({ "docs/programs/alpha/progress.md": notLast }), "docs/programs/alpha/progress.md", "this-commit");
  assertClean(run({ "docs/programs/alpha/progress.md": progress({ milestones: ["- 2026-01-01 A (abc1234).", "- 2026-01-02 B (this commit)."] }) }));
});

test("problems-shape: sections, open-entry fields, resolved lines and unique IDs", () => {
  const file = "docs/programs/alpha/problems.md";
  assertViolation(run({ [file]: "# Problems\n\n## Open\n" }), file, "problems-shape");
  assertViolation(run({ [file]: problems(OPEN_ENTRY("AL-P1").replace("\n- Exit condition: x.", ""), "") }), file, "problems-shape");
  assertViolation(run({ [file]: problems("### Something\n\n- Status: Open.", "") }), file, "problems-shape");
  assertViolation(run({ [file]: problems(OPEN_ENTRY("AL-P1"), "- AL-P1 — Resolved 2026-01-01: dup (abc1234).") }), file, "problems-shape");
  assertViolation(run({ [file]: problems(OPEN_ENTRY("AL-P1"), "A paragraph instead of a list line.") }), file, "problems-shape");
  assertViolation(run({ [file]: problems("- AL-P5: a loose line\n\n" + OPEN_ENTRY("AL-P1"), "") }), file, "problems-shape", 5);
  assertViolation(run({ [file]: problems(OPEN_ENTRY("AL-P1"), "- AL-P2: no em dash") }), file, "problems-shape");
  assertViolation(run({ [file]: "# Problems\n\n- AL-P7: before any section\n\n## Open\n\n## Resolved\n" }), file, "problems-shape", 3);
  assertClean(run({ [file]: problems(OPEN_ENTRY("AL-P1") + "\n\n" + OPEN_ENTRY("AL-P2"), "") }));
  assertClean(run({ [file]: problems("None yet.", "") }));
  // A malformed declaration after a complete entry is not swallowed as that entry's content.
  assertViolation(run({ [file]: problems(OPEN_ENTRY("AL-P1") + "\n\n- AL-P2 — Done: fixed (PR #42)", "") }), file, "problems-shape", 13);
  assertViolation(run({ [file]: problems(OPEN_ENTRY("AL-P1") + "\n\n- AL-P3: another problem", "") }), file, "problems-shape", 13);
  // References are not declarations: prose, a link, a field value and an entry body that mention IDs.
  assertClean(run({ [file]: problems("See [AL-P1](plan.md) and AL-P2 in prose.\n\n" + OPEN_ENTRY("AL-P1").replace("- Evidence: e.", "- Evidence: related to BL-P1 and [BL-F1](x.md)."), "") }));
  assertClean(run({ [file]: problems(OPEN_ENTRY("AL-P1"), "- AL-P9 — Resolved 2026-01-01: done, see AL-P1 (abc1234).") }));
});

test("no-state-in-plan: State sections fail, similar headings and a one-line pointer pass", () => {
  const file = "docs/programs/alpha/plan.md";
  assertViolation(run({ [file]: "# Master plan\n\n## State\n\nWe are on step 3.\n" }), file, "no-state-in-plan", 3);
  assertViolation(run({ [file]: "# Master plan\n\n## 4. Current State\n\nText.\n" }), file, "no-state-in-plan", 3);
  assertClean(run({ [file]: `${MASTER}\n## State transitions\n\nText.\n\n## Statement\n\nText.\n` }));
  assertClean(run({ [file]: `${MASTER}\n## State\n\nSee [progress.md](progress.md).\n` }));
  assertViolation(run({ [file]: "# Master plan\n\n## State\n\nSee [progress.md.bak](progress.md.bak).\n" }), file, "no-state-in-plan", 3);
});

test("plan-progress-link: a root detail plan needs a progress link, a master plan does not", () => {
  const solo = "docs/programs/solo/plan.md";
  assertViolation(run({ [solo]: "# Detail plan\n\n## 1. Binding Spec\n" }), solo, "plan-progress-link", 1);
  assertViolation(run({ [solo]: "# Detail plan\n\nProgress: `progress.md`.\n" }), solo, "plan-progress-link", 1);
  assertClean(run({ [solo]: `${DETAIL.replace("[progress.md](progress.md)", "[progress][p]")}\n[p]: progress.md\n` }));
  assertViolation(run({ [solo]: "# Detail plan\n\nProgress: [other](../alpha/progress.md).\n" }), solo, "plan-progress-link", 1);
  assertViolation(run({ [solo]: "# Detail plan\n\nProgress: [web](https://example.com/progress.md).\n" }), solo, "plan-progress-link", 1);
  assertViolation(
    run({ [UNIT_PATH]: UNIT_DETAIL.replace("(../../progress.md)", "(../../../solo/progress.md)") }),
    UNIT_PATH,
    "plan-progress-link",
    1,
  );
  assertViolation(
    run({ "docs/programs/alpha/plan.md": "# Master plan\n\n## State\n\nSee [progress.md](../solo/progress.md).\n" }),
    "docs/programs/alpha/plan.md",
    "no-state-in-plan",
    3,
  );
  assertViolation(run({ [UNIT_PATH]: "# AL-U1\n\n## 1. Binding Spec\n" }), UNIT_PATH, "plan-progress-link", 1);
  assertClean(run({ "docs/programs/alpha/plan.md": MASTER }));
});

test("plan-shape: role by title, template sections, unit IDs, folders and titles", () => {
  const master = "docs/programs/alpha/plan.md";
  const solo = "docs/programs/solo/plan.md";
  // A root plan titled as a master plan is one before implementation-plans/ exists; afterwards it must be.
  assertClean(run({ [solo]: MASTER.replaceAll("AL-U1", "SO-U1") }));
  assertViolation(run({ [master]: DETAIL }), master, "plan-shape", 1);
  // Template sections: present, titled and ordered as in the template; extra sections may follow.
  assertViolation(run({ [master]: MASTER.replace("## 3. Shared invariants\n", "") }), master, "plan-shape");
  assertViolation(run({ [master]: MASTER.replace("## 6. Program risks", "## 6. Risks") }), master, "plan-shape");
  assertViolation(run({ [solo]: DETAIL.replace("## 2. Repository facts", "## 2. Facts") }), solo, "plan-shape");
  assertClean(run({ [solo]: `${DETAIL}\n## Appendix A — notes\n` }));
  // Units table: each row starts with a unique U<n>.
  assertViolation(run({ [master]: MASTER.replace("| AL-U1 First |", "| I1 First |") }), master, "plan-shape");
  assertViolation(run({ [master]: MASTER.replace("| AL-U1 First | `b1` |\n", "| AL-U1 First | `b1` |\n| AL-U1 Again | `b2` |\n") }), master, "plan-shape");
  // Titles: a root detail plan has none, a unit detail plan has its U<n> matching folder and table.
  assertViolation(run({ [solo]: DETAIL.replace("# SO-U1 detail plan", "# AL-U1 detail plan") }), solo, "work-id", 1);
  assertViolation(run({ [UNIT_PATH]: UNIT_DETAIL.replace("# AL-U1 detail plan", "# AL-U2 detail plan") }), UNIT_PATH, "plan-shape", 1);
  const noSlug = "docs/programs/alpha/implementation-plans/al-u1/plan.md";
  assertViolation(run({ [UNIT_PATH]: null, [noSlug]: UNIT_DETAIL }), noSlug, "plan-shape", 1);
  const notInTable = "docs/programs/alpha/implementation-plans/al-u2-second/plan.md";
  const missing = run({ [notInTable]: UNIT_DETAIL.replace("# AL-U1 detail plan", "# AL-U2 detail plan") });
  assertViolation(missing, notInTable, "plan-shape", 1);
  assert.match(missing.stderr, /AL-U2 is not a row of the master plan's Units table/);
});

// An entry plan: a delivery program's detail plan for an ID of its own problems.md or future-features.md,
// at implementation-plans/<id>-<slug>/plan.md, with no Units row.
const entryPath = (folder, program = "alpha") => `docs/programs/${program}/implementation-plans/${folder}/plan.md`;
const entryPlan = (id) => UNIT_DETAIL.replace("# AL-U1 detail plan", `# ${id} detail plan`);
const ENTRY_PATH = entryPath("al-f10-idea");
const ALPHA_FEATURES = "docs/programs/alpha/future-features.md";
const ALPHA_PROBLEMS = "docs/programs/alpha/problems.md";

test("entry plan (AC1): an open future-features entry of the program needs no Units row", () => {
  assertClean(run({ [ENTRY_PATH]: entryPlan("AL-F10") }));
});

test("entry plan (AC2): every home of an ID in the program's own two files passes", () => {
  const entry = (folder, id) => ({ [entryPath(folder)]: entryPlan(id) });
  assertClean(run(entry("al-p1-something", "AL-P1")));
  assertClean(run(entry("al-p9-old", "AL-P9")));
  const closed = `# F\n\n${FEATURE("AL-F10")}\n## Closed\n\n- AL-F12 — Done: shipped (PR #3)\n- AL-F13 — Dropped: not needed\n`;
  assertClean(run({ [ALPHA_FEATURES]: closed, ...entry("al-f12-shipped", "AL-F12") }));
  assertClean(run({ [ALPHA_FEATURES]: closed, ...entry("al-f13-dropped", "AL-F13") }));
});

test("entry plan (AC3): an ID outside the program's own entries is a plan-shape violation", () => {
  const unknown = entryPath("al-f99-nowhere");
  const result = run({ [unknown]: entryPlan("AL-F99") });
  assertViolation(result, unknown, "plan-shape", 1);
  assert.match(result.stderr, /AL-F99 is not an open or closed entry/);
  // Another program's entry (solo's problem, the backlog's feature) does not count.
  const solo = entryPath("so-p1-other");
  assertViolation(run({ [solo]: entryPlan("SO-P1") }), solo, "plan-shape", 1);
  const backlog = entryPath("bl-f1-backlog");
  assertViolation(run({ [backlog]: entryPlan("BL-F1") }), backlog, "plan-shape", 1);
  // A `Moved to` line is a pointer to the new home, not an entry of this program.
  const movedFeature = entryPath("al-f14-gone");
  assertViolation(
    run({
      [ALPHA_FEATURES]: `# F\n\n${FEATURE("AL-F10")}\n## Closed\n\n- AL-F14 — Moved to [beta](../beta/future-features.md)\n`,
      "docs/programs/beta/future-features.md": `# F\n\n${FEATURE("AL-F14")}`,
      [movedFeature]: entryPlan("AL-F14"),
    }),
    movedFeature,
    "plan-shape",
    1,
  );
  const movedProblem = entryPath("al-p9-gone");
  assertViolation(
    run({
      [ALPHA_PROBLEMS]: problems(OPEN_ENTRY("AL-P1"), "- AL-P9 — Moved 2026-01-01 to [beta](../beta/plan.md)"),
      [movedProblem]: entryPlan("AL-P9"),
    }),
    movedProblem,
    "plan-shape",
    1,
  );
  // Folder ID and title ID differ.
  const mismatch = run({ [ENTRY_PATH]: entryPlan("AL-F11") });
  assertViolation(mismatch, ENTRY_PATH, "plan-shape", 1);
  assert.match(mismatch.stderr, /title says AL-F11 but the folder says al-f10/);
  // Folder ID not lowercase, or no slug.
  const upper = entryPath("AL-F10-idea");
  assertViolation(run({ [upper]: entryPlan("AL-F10") }), upper, "plan-shape", 1);
  const noSlug = entryPath("al-f10");
  assertViolation(run({ [noSlug]: entryPlan("AL-F10") }), noSlug, "plan-shape", 1);
  // A malformed title is reported even when the folder is valid.
  assertViolation(run({ [ENTRY_PATH]: UNIT_DETAIL.replace("# AL-U1 detail plan", "# Idea plan") }), ENTRY_PATH, "plan-shape", 1);
});

test("entry plan (AC4): an evergreen program's initiatives stay u<n> charter rows", () => {
  const evergreenEntry = `${GAMMA}/implementation-plans/ga-p1-thing/plan.md`;
  const result = run({ ...EVERGREEN, [evergreenEntry]: entryPlan("GA-P1") });
  assertViolation(result, evergreenEntry, "plan-shape", 1);
  assert.match(result.stderr, /evergreen program/);
});

test("entry plan (AC5): a program with a detail plan as root still needs a master plan", () => {
  const solo = "docs/programs/solo/plan.md";
  assertViolation(run({ [entryPath("so-p1-thing", "solo")]: entryPlan("SO-P1") }), solo, "plan-shape", 1);
});

test("entry plan: unit folders keep their rules", () => {
  const badUnit = "docs/programs/alpha/implementation-plans/AL-U1-first/plan.md";
  assertViolation(run({ [UNIT_PATH]: null, [badUnit]: UNIT_DETAIL }), badUnit, "plan-shape", 1);
  // A unit plan is not an entry plan: it still needs its Units row.
  const notInTable = "docs/programs/alpha/implementation-plans/al-u2-second/plan.md";
  assertViolation(run({ [notInTable]: UNIT_DETAIL.replace("# AL-U1 detail plan", "# AL-U2 detail plan") }), notInTable, "plan-shape", 1);
});

const EVERGREEN = evergreenTree();
const CHARTER_FILE = `${GAMMA}/README.md`;
const gammaInitiative = (title) => UNIT_DETAIL.replace("# AL-U1 detail plan", `# ${title.replace("AL-", "GA-")} detail plan`);
const programsReadme = (gammaLifecycle) =>
  README(["| `programs/alpha` | active |", "| `programs/solo` | closed |", `| \`programs/gamma\` | ${gammaLifecycle} |`]);

test("evergreen (a): a valid evergreen program passes next to active and closed programs", () => {
  assertClean(run(EVERGREEN));
  assertClean(run({ ...EVERGREEN, [CHARTER_FILE]: `${CHARTER}\n## Appendix A — notes\n` }));
  // A charter with no initiatives yet is valid.
  assertClean(run({ ...EVERGREEN, [CHARTER_FILE]: CHARTER.replace("| AL-U1 First | `b1` |\n", ""), [GAMMA_UNIT_PATH]: null }));
});

test("evergreen (b): a root plan.md in an evergreen program is a file-role violation", () => {
  assertViolation(run({ ...EVERGREEN, [`${GAMMA}/plan.md`]: MASTER }), `${GAMMA}/plan.md`, "file-role", 1);
  assertViolation(run({ ...EVERGREEN, [`${GAMMA}/plan.md`]: DETAIL }), `${GAMMA}/plan.md`, "file-role", 1);
});

test("evergreen (c): an evergreen program without README.md fails", () => {
  assertViolation(run({ ...EVERGREEN, [CHARTER_FILE]: null }), `${GAMMA}/progress.md`, "plan-shape", 1);
});

test("evergreen (d): a charter with a wrong title fails", () => {
  assertViolation(run({ ...EVERGREEN, [CHARTER_FILE]: CHARTER.replace("# Charter — Gamma", "# Master plan — Gamma") }), CHARTER_FILE, "plan-shape", 1);
  assertViolation(run({ ...EVERGREEN, [CHARTER_FILE]: CHARTER.replace("# Charter — Gamma", "# Gamma") }), CHARTER_FILE, "plan-shape", 1);
});

test("evergreen (e): a charter section missing or out of order fails", () => {
  assertViolation(run({ ...EVERGREEN, [CHARTER_FILE]: CHARTER.replace("## 3. Invariants\n", "") }), CHARTER_FILE, "plan-shape");
  const swapped = CHARTER.replace("## 2. Owner decisions\n", "## @@\n").replace("## 3. Invariants\n", "## 2. Owner decisions\n").replace("## @@\n", "## 3. Invariants\n");
  assertViolation(run({ ...EVERGREEN, [CHARTER_FILE]: swapped }), CHARTER_FILE, "plan-shape");
});

test("evergreen (f): an Initiatives row without a U<n> ID fails", () => {
  assertViolation(run({ ...EVERGREEN, [CHARTER_FILE]: CHARTER.replace("| GA-U1 First |", "| I1 First |") }), CHARTER_FILE, "plan-shape");
});

test("evergreen (g): a duplicate Initiatives ID fails", () => {
  const duplicate = CHARTER.replace("| GA-U1 First | `b1` |\n", "| GA-U1 First | `b1` |\n| GA-U1 Again | `b2` |\n");
  assertViolation(run({ ...EVERGREEN, [CHARTER_FILE]: duplicate }), CHARTER_FILE, "plan-shape");
});

test("evergreen (h): an initiative plan missing from the Initiatives table fails", () => {
  const notInTable = `${GAMMA}/implementation-plans/ga-u2-second/plan.md`;
  const missing = run({ ...EVERGREEN, [notInTable]: gammaInitiative("AL-U2") });
  assertViolation(missing, notInTable, "plan-shape", 1);
  assert.match(missing.stderr, /GA-U2 is not a row of the charter's Initiatives table/);
});

test("evergreen (i): an initiative whose title number differs from its folder fails", () => {
  assertViolation(run({ ...EVERGREEN, [GAMMA_UNIT_PATH]: gammaInitiative("AL-U2") }), GAMMA_UNIT_PATH, "plan-shape", 1);
});

test("evergreen (j): a root README.md in an active program is a file-role violation", () => {
  assertViolation(run({ "docs/programs/alpha/README.md": CHARTER }), "docs/programs/alpha/README.md", "file-role", 1);
});

test("evergreen (k): a root README.md in a closed program is a file-role violation", () => {
  assertViolation(run({ "docs/programs/solo/README.md": CHARTER }), "docs/programs/solo/README.md", "file-role", 1);
});

test("evergreen: the kind is the Lifecycle value, and initiative plans and the charter keep the plan rules", () => {
  // The same files under an `active` row are not a charter program.
  assertViolation(run({ ...EVERGREEN, "docs/README.md": programsReadme("active") }), CHARTER_FILE, "file-role", 1);
  const paused = run({ ...EVERGREEN, "docs/README.md": programsReadme("paused") });
  assertViolation(paused, "docs/README.md", "programs-index");
  assert.match(paused.stderr, /must be active, closed or evergreen/);
  // An initiative plan is a detail plan: it links its own progress.md. A charter has no State section.
  assertViolation(run({ ...EVERGREEN, [GAMMA_UNIT_PATH]: "# AL-U1 detail plan — x\n\n## 1. Binding Spec\n" }), GAMMA_UNIT_PATH, "plan-progress-link", 1);
  assertViolation(run({ ...EVERGREEN, [CHARTER_FILE]: `${CHARTER}\n## State\n\nWe are on step 3.\n` }), CHARTER_FILE, "no-state-in-plan");
});

test("future-features-shape: heading, fields and IDs unique across all files", () => {
  const file = "docs/programs/alpha/future-features.md";
  assertViolation(run({ [file]: "# F\n\n## A loose idea\n" }), file, "future-features-shape", 3);
  assertViolation(run({ [file]: "# F\n\n## AL-F10: Idea\n\n- Status: Deferred.\n- Direction: d.\n" }), file, "future-features-shape", 3);
  assertViolation(run({ [file]: `# F\n\n${FEATURE("BL-F1")}` }), file, "future-features-shape", 3);
  assertViolation(run({ [file]: `# F\n\n${FEATURE("AL-F10")}${FEATURE("AL-F10")}` }), file, "future-features-shape");
  assertViolation(run({ [file]: "# F\n\n## Closed\n\n- AL-F20 — Fixed it\n" }), file, "future-features-shape", 5);
  assertViolation(run({ [file]: "# F\n\n## Closed\n\n- BL-P20 — Dropped: wrong prefix\n" }), file, "work-id", 5);
  assertViolation(run({ [file]: `# F\n\n- AL-F30: a loose idea\n\n${FEATURE("AL-F11")}` }), file, "future-features-shape", 3);
  const loose = "docs/notes/future-features.md";
  assertViolation(run({ [loose]: `# F\n\n${FEATURE("BL-F1")}` }), loose, "future-features-shape", 3);
  assertViolation(run({ [loose]: "# F\n\n## AL-F40: Idea\n\n- Status: Deferred.\n" }), loose, "future-features-shape", 3);
  assertViolation(run({ "docs/programs/solo/future-features.md": `# F\n\n${FEATURE("BL-F1")}` }), "docs/programs/solo/future-features.md", "future-features-shape", 3);
  assertViolation(run({ [loose]: `# F\n\n${FEATURE("AL-F41")}` }), loose, "work-id");
  assertViolation(run({ [file]: `# F\n\n${FEATURE("AL-F10", "- AL-F50: loose after an entry")}` }), file, "future-features-shape", 8);
  assertViolation(run({ [file]: `# F\n\n${FEATURE("AL-F10")}\n- AL-F51 — Dropped: not under Closed` }), file, "future-features-shape");
  assertClean(run({ [file]: `# F\n\nRelated: [BL-F1](../../backlog/future-features.md), and AL-P1 in prose.\n\n${FEATURE("AL-F10", "Context: see BL-F1.")}` }));
  assertClean(run({ [file]: `# F\n\n${FEATURE("AL-F10")}${FEATURE("AL-F11")}` }));
  const target = "docs/programs/solo/future-features.md";
  const moved = "# F\n\n## Closed\n\n- AL-F60 — Moved to [solo](../solo/future-features.md)\n";
  const transfer = { from: { file, id: "AL-F60" }, to: { file: target, id: "SO-F60" } };
  const mappingFile = "scripts/docs/work-id-mappings.json";
  const mappings = JSON.parse(baseTree()[mappingFile]);
  assertClean(run({ [file]: moved, [target]: `# F\n\n${FEATURE("SO-F60")}`, [mappingFile]: JSON.stringify([...mappings, transfer]) }));
  assertViolation(run({ [file]: moved }), file, "work-mapping", 5);
  assertViolation(run({
    [file]: moved,
    [target]: `# F\n\n${FEATURE("SO-F60")}`,
    "docs/backlog/future-features.md": moved.replace("../solo/", "../programs/solo/"),
    [mappingFile]: JSON.stringify([...mappings, transfer]),
  }), "docs/backlog/future-features.md", "work-id");
});

test("backlog-shape: backlog problems and features are open with full fields or closed as one line", () => {
  const problemsFile = "docs/backlog/problems.md";
  assertViolation(run({ [problemsFile]: problems(OPEN_ENTRY("BL-P1"), "- BL-P2 — Resolved 2026-01-01: fixed (abc1234).") }), problemsFile, "problems-shape");
  assertViolation(run({ [problemsFile]: problems(OPEN_ENTRY("BL-P1"), "- BL-P2 — Done: fixed it") }), problemsFile, "problems-shape");
  assertViolation(run({ [problemsFile]: problems(OPEN_ENTRY("BL-P1"), "- BL-P2 — Moved to alpha") }), problemsFile, "problems-shape");
  assertViolation(run({ [problemsFile]: problems(OPEN_ENTRY("BL-P1").replace("- Evidence: e.\n", ""), "") }), problemsFile, "problems-shape");
  assertViolation(run({ "docs/backlog/notes.md": "# Notes\n" }), "docs/backlog/notes.md", "backlog-shape", 1);
  assertClean(run());
});

test("backlog-not-program: the backlog has no plan, no progress and no Programs row", () => {
  assertViolation(run({ "docs/backlog/progress.md": progress() }), "docs/backlog/progress.md", "backlog-not-program", 1);
  assertViolation(run({ "docs/backlog/plan.md": "# Plan\n" }), "docs/backlog/plan.md", "backlog-not-program", 1);
  assertViolation(
    run({ "docs/README.md": README(["| `programs/alpha` | active |", "| `programs/solo` | closed |", "| `backlog` | active |"]) }),
    "docs/README.md",
    "backlog-not-program",
  );
});

test("programs-index: one row per program, rows point to programs, lifecycle is valid", () => {
  assertViolation(run({ "docs/README.md": README(["| `programs/alpha` | active |"]) }), "docs/README.md", "programs-index");
  assertViolation(
    run({ "docs/README.md": README(["| `programs/alpha` | active |", "| `programs/alpha` | active |", "| `programs/solo` | closed |"]) }),
    "docs/README.md",
    "programs-index",
  );
  assertViolation(
    run({ "docs/README.md": README(["| `programs/alpha` | active |", "| `programs/solo` | closed |", "| `programs/ghost` | active |"]) }),
    "docs/README.md",
    "programs-index",
  );
  assertViolation(
    run({ "docs/README.md": README(["| `programs/alpha` | paused |", "| `programs/solo` | closed |"]) }),
    "docs/README.md",
    "programs-index",
  );
  assertViolation(run({ "docs/README.md": "# Docs\n" }), "docs/README.md", "programs-index");
  assertViolation(run({ "docs/README.md": null }), "docs/README.md", "programs-index", 1);
  assertClean(run({ "docs/README.md": README(["| `programs/alpha/` | active |", "| programs/solo | closed |"]) }));
});

test("adr-index: every ADR file is linked from docs/adr/README.md, the README itself is exempt", () => {
  assertViolation(run({ "docs/adr/two.md": "# Two\n" }), "docs/adr/README.md", "adr-index", 1);
  assertViolation(run({ "docs/adr/README.md": null }), "docs/adr/one.md", "adr-index", 1);
  assertClean(run({ "docs/adr/two.md": "# Two\n", "docs/adr/README.md": "# ADRs\n\n- [one](one.md)\n- [two][t]\n\n[t]: two.md\n" }));
});

function hotfixTree() {
  return {
    "docs/README.md": README(["| `programs/alpha` | active |", "| `programs/solo` | closed |", "| `programs/security-hotfix` | closed |"]),
    "docs/programs/security-hotfix/plan.md": LEGACY_PLAN,
    "docs/programs/security-hotfix/plan-h2.md": legacyDeclarations.find(e => e.role === "legacy-plan" && e.file.endsWith("plan-h2.md")).form + "\n",
    "docs/programs/security-hotfix/progress.md": progress(),
    "docs/programs/security-hotfix/problems.md": problems(OPEN_ENTRY("SH-P3"), "- SH-P1 — Resolved 2026-01-01: delivered (abc1234)."),
  };
}

test("security-hotfix allowlist: only two historical plan path and rule pairs remain", () => {
  assert.deepEqual(ALLOWLIST.map(({ file, rule }) => [file, rule]), [
    ["docs/programs/security-hotfix/plan-h2.md", "file-role"],
    ["docs/programs/security-hotfix/plan.md", "plan-shape"],
  ]);
  const hotfix = hotfixTree();
  assertClean(run(hotfix));
  assertViolation(run({ ...hotfix, "docs/programs/security-hotfix/other.md": "# Other\n" }), "docs/programs/security-hotfix/other.md", "file-role", 1);
  assertViolation(
    run({ ...hotfix, "docs/programs/security-hotfix/progress.md": progress({ fields: STATE_ROWS.slice(1) }) }),
    "docs/programs/security-hotfix/progress.md",
    "progress-state",
  );
  assertViolation(
    run({ ...hotfix, "docs/programs/security-hotfix/plan.md": "# Plan\n\nNo link.\n" }),
    "docs/programs/security-hotfix/plan.md",
    "plan-progress-link",
    1,
  );
  const moved = {
    ...hotfix,
    "docs/README.md": README(["| `programs/alpha` | active |", "| `programs/solo` | closed |", "| `programs/other` | closed |"]),
    "docs/programs/other/plan.md": LEGACY_PLAN,
    "docs/programs/other/plan-h2.md": legacyDeclarations.find(e => e.role === "legacy-plan" && e.file.endsWith("plan-h2.md")).form + "\n",
    "docs/programs/other/progress.md": progress(),
    "docs/programs/other/problems.md": "# Problems\n\n| # | Problem |\n| --- | --- |\n| P1 | text |\n",
  };
  const result = run(moved);
  assertViolation(result, "docs/programs/other/plan-h2.md", "file-role", 1);
  assertViolation(result, "docs/programs/other/problems.md", "problems-shape");
  assertViolation(result, "docs/programs/other/plan.md", "plan-shape");
});

test("unknown arguments and a missing root exit 2", () => {
  assert.equal(spawnSync(process.execPath, [scriptPath, "--bogus", "x"], { encoding: "utf8" }).status, 2);
  assert.equal(spawnSync(process.execPath, [scriptPath, "--root", join(tmpdir(), "does-not-exist-docs-check")], { encoding: "utf8" }).status, 2);
});

const mappingFile = "scripts/docs/work-id-mappings.json";
const withMappings = (items) => ({ [mappingFile]: JSON.stringify([...JSON.parse(baseTree()[mappingFile]), ...items]) });
const transfer = (file, id, destination, newId) => ({ from: { file, id }, to: { file: destination, id: newId } });

test("program codes: missing, duplicate, malformed and reserved codes fail", () => {
  const valid = baseTree()["docs/README.md"];
  for (const bad of ["", "A", "ABCDE", "al", "A1", "BL", "SO"]) {
    assertViolation(run({ "docs/README.md": valid.replace("| AL |", `| ${bad} |`) }), "docs/README.md", "program-code");
  }
  assertViolation(run({ "docs/README.md": valid.replace("| Code ", "| Missing ") }), "docs/README.md", "programs-index");
});

test("work IDs: owner, kind, number and nonempty heading/table titles are enforced", () => {
  for (const id of ["XX-F1", "SO-F1", "AL-P1", "AL-F0", "AL-F01", "FEAT-999", "AL-F-1"]) {
    assertViolation(run({ [ALPHA_FEATURES]: `# F\n\n${FEATURE(id)}` }), ALPHA_FEATURES, "work-id");
  }
  assertViolation(run({ [ALPHA_FEATURES]: FEATURE("AL-F1").replace(": Something", ": ") }), ALPHA_FEATURES, "work-id");
  assertViolation(run({ [ALPHA_PROBLEMS]: problems(OPEN_ENTRY("AL-F1"), "") }), ALPHA_PROBLEMS, "work-id");
  assertViolation(run({ "docs/programs/alpha/plan.md": MASTER.replace("AL-U1 First", "AL-U1 ") }), "docs/programs/alpha/plan.md", "work-id");
  assertClean(run({ [ALPHA_FEATURES]: FEATURE("AL-F4") + FEATURE("AL-F2") })); // No gap diagnostic.
});

test("canonical ownership: open/open and open/closed duplicates fail, independent kinds/owners pass", () => {
  assertViolation(run({ [ALPHA_FEATURES]: FEATURE("AL-F3") + FEATURE("AL-F3") }), ALPHA_FEATURES, "work-ownership");
  assertViolation(run({ [ALPHA_FEATURES]: FEATURE("AL-F3") + "\n## Closed\n\n- AL-F3 — Dropped: duplicate\n" }), ALPHA_FEATURES, "work-ownership");
  assertClean(run({ [ALPHA_FEATURES]: FEATURE("AL-F3"), [ALPHA_PROBLEMS]: problems(OPEN_ENTRY("AL-P3"), ""), "docs/programs/solo/future-features.md": FEATURE("SO-F3") }));
  assertViolation(run({ "docs/programs/solo/future-features.md": FEATURE("AL-F10") }), "docs/programs/solo/future-features.md", "work-ownership");
});

test("new plan identities: uppercase/slugless folders, foreign titles and table IDs fail", () => {
  for (const folder of ["AL-U1-first", "al-u1", "al-u1-bad_slug"]) {
    const file = `docs/programs/alpha/implementation-plans/${folder}/plan.md`;
    assertViolation(run({ [UNIT_PATH]: null, [file]: UNIT_DETAIL }), file, "plan-shape");
  }
  assertViolation(run({ [UNIT_PATH]: UNIT_DETAIL.replace("AL-U1", "SO-U1") }), UNIT_PATH, "work-id");
  assertViolation(run({ [UNIT_PATH]: UNIT_DETAIL.replace("AL-U1", "AL-U01") }), UNIT_PATH, "work-id");
  assertViolation(run({ "docs/programs/alpha/plan.md": MASTER.replace("AL-U1", "SO-U1") }), "docs/programs/alpha/plan.md", "work-id");
  assertClean(run({ [UNIT_PATH]: null, "docs/programs/alpha/plan.md": UNIT_DETAIL.replace("../../progress.md", "progress.md") }));
});

test("legacy boundary: exact closed form passes; copy, new closed legacy, role reuse and reopening fail", () => {
  const old = legacyDeclarations.find(e => e.file === "docs/programs/dependency-maintenance/problems.md" && e.id === "DM-003");
  const dir = "docs/programs/dependency-maintenance";
  const fixture = {
    "docs/README.md": baseTree()["docs/README.md"] + "| `programs/dependency-maintenance` | DM | active |\n",
    [`${dir}/progress.md`]: progress(), [`${dir}/plan.md`]: DETAIL.replace("SO-U1", "DM-U1"),
    [old.file]: problems("None yet.", old.form),
  };
  assertClean(run(fixture));
  assertViolation(run({ ...fixture, [old.file]: problems("None yet.", old.form + "\n- DM-999 — Resolved: invented") }), old.file, "work-id");
  assertViolation(run({ [ALPHA_PROBLEMS]: problems("None yet.", old.form) }), ALPHA_PROBLEMS, "work-id");
  assertViolation(run({ ...fixture, [old.file]: problems(OPEN_ENTRY("DM-003"), "") }), old.file, "work-id");
  assertViolation(run({ ...fixture, [old.file]: problems(old.form, "") }), old.file, "work-id");
  assertViolation(run({ ...fixture, [old.file]: problems("None yet.", old.form.replace("Resolved", "Reopened")) }), old.file, "work-id");
  // A mapping is a reference, never an exception authorizing a declaration.
  assertViolation(run({ ...fixture, [old.file]: problems(OPEN_ENTRY("DM-999"), old.form), ...withMappings([transfer(old.file, "DM-999", old.file, "DM-003")]) }), old.file, "work-id");
});

test("security problems: legacy tables fail, canonical entries require all fields and historical plan identities stay frozen", () => {
  const dir = "docs/programs/security-hotfix", file = `${dir}/problems.md`;
  const fixture = hotfixTree();
  assertClean(run(fixture));
  // Formerly allowlisted exact forms no longer authorize any table declaration.
  for (const row of ["| P1 | `profiles` SELECT `true` for `public`: anon can read the email, phone, dob, gender, province of everyone | High | **H2** |", "| ~~P12~~ | closed |", "| AW-003 | old |", "| P32 | new |", "| SH-P2 | new |", "| WRONG | new |", "| P01 | old |"]) {
    const table = `# Problems\n\n| # | Problem |\n| --- | --- |\n${row}\n`;
    const result = run({ ...fixture, [file]: table });
    assertViolation(result, file, "work-id");
    assertViolation(result, file, "problems-shape");
    assertViolation(run({ ...fixture, [file]: table + "\n" + fixture[file] }), file, "work-id");
  }
  for (const field of ["Status", "Problem", "Evidence", "Direction", "Exit condition"]) {
    const missing = fixture[file].replace(new RegExp(`^- ${field}:.*\\n?`, "m"), "");
    assertViolation(run({ ...fixture, [file]: missing }), file, "problems-shape");
  }
  for (const name of ["plan.md", "plan-h2.md"]) {
    const path = `${dir}/${name}`;
    assertViolation(run({ ...fixture, [path]: fixture[path].replace(/^# .+/, "# Another identity") }), path, "work-id");
  }
});

test("security entry plans: owned SH-P passes beside the legacy root; foreign, unknown and unit claims fail", () => {
  const fixture = hotfixTree();
  const file = entryPath("sh-p3-community-write-integrity", "security-hotfix");
  assertClean(run({ ...fixture, [file]: entryPlan("SH-P3") }));
  // The migration reserves its original IDs without capping later allocations or requiring continuity.
  assertClean(run({ ...fixture, [file]: entryPlan("SH-P3"),
    "docs/programs/security-hotfix/problems.md": problems(OPEN_ENTRY("SH-P3") + "\n\n" + OPEN_ENTRY("SH-P33") + "\n\n" + OPEN_ENTRY("SH-P40"), ""),
  }));
  const noOwner = { ...fixture, "docs/programs/security-hotfix/problems.md": problems("None yet.", "") };
  assertViolation(run({ ...noOwner, [file]: entryPlan("SH-P3") }), file, "plan-shape");
  for (const id of ["SH-P99", "SO-P1", "AL-P1"]) {
    const path = entryPath(`${id.toLowerCase()}-unknown`, "security-hotfix");
    assertViolation(run({ ...fixture, [path]: entryPlan(id) }), path, "plan-shape");
  }
  const unit = entryPath("sh-u1-no-units-row", "security-hotfix");
  const result = run({ ...fixture, [unit]: UNIT_DETAIL.replaceAll("AL-U1", "SH-U1") });
  assertViolation(result, unit, "plan-shape");
  assert.match(result.stderr, /SH-U1 is not a row of the master plan's Units table/);
  assertViolation(run({ ...fixture, [file]: entryPlan("SH-P3").replace("## 2. Repository facts", "## 2. Wrong") }), file, "plan-shape");
  assertViolation(run({ ...fixture, [file]: entryPlan("SH-P3").replace("[progress.md](../../progress.md)", "no link") }), file, "plan-progress-link");
});

test("security AW-003 provenance: original moved pointer follows the appended chain to SH-P32", () => {
  const source = "docs/programs/agent-workflow/problems.md", target = "docs/programs/security-hotfix/problems.md";
  const old = legacyDeclarations.find(e => e.file === source && e.id === "AW-003");
  const first = transfer(source, "AW-003", target, "AW-003");
  const second = transfer(target, "AW-003", target, "SH-P32");
  const fixture = { ...hotfixTree(),
    "docs/README.md": hotfixTree()["docs/README.md"] + "| `programs/agent-workflow` | AW | active |\n",
    "docs/programs/agent-workflow/plan.md": DETAIL.replaceAll("SO-U1", "AW-U1"),
    "docs/programs/agent-workflow/progress.md": progress(),
    [source]: problems("None yet.", old.form), [target]: problems(OPEN_ENTRY("SH-P32"), ""),
  };
  assertClean(run({ ...fixture, ...withMappings([first, second]) }));
  assertViolation(run({ ...fixture, ...withMappings([first]) }), source, "work-mapping");
  assertViolation(run({ ...fixture, [target]: problems("None yet.", ""), ...withMappings([first, second]) }), source, "work-mapping");
  // A historical alias cannot own a new entry plan even though its trace resolves.
  const alias = entryPath("aw-003-alias", "security-hotfix");
  assertViolation(run({ ...fixture, [alias]: entryPlan("AW-003"), ...withMappings([first, second]) }), alias, "plan-shape");
});

test("mappings: direct/chained transfers resolve one owner and pointers do not own entries", () => {
  const source = "docs/backlog/future-features.md", middle = ALPHA_FEATURES, destination = "docs/programs/solo/future-features.md";
  const fixture = {
    [source]: "# F\n\n## Closed\n\n- BL-F20 — Moved to [alpha](../programs/alpha/future-features.md)\n",
    [middle]: FEATURE("AL-F1") + "\n## Closed\n\n- AL-F2 — Moved to [solo](../solo/future-features.md)\n",
    [destination]: FEATURE("SO-F3"),
  };
  const first = transfer(source, "BL-F20", middle, "AL-F2"), second = transfer(middle, "AL-F2", destination, "SO-F3");
  assertClean(run({ ...fixture, ...withMappings([first, second]) }));
  assertViolation(run({ ...fixture, ...withMappings([first]) }), source, "work-mapping");
  assertViolation(run({ ...fixture, ...withMappings([first, second, first]) }), source, "work-mapping");
  assertViolation(run({ ...fixture, ...withMappings([first, transfer(middle, "AL-F2", source, "BL-F20")]) }), source, "work-mapping");
  assertViolation(run({ ...fixture, ...withMappings([first, transfer(middle, "AL-F2", destination, "SO-F99")]) }), source, "work-mapping");
  assertViolation(run({ ...fixture, [middle]: FEATURE("AL-F2") + fixture[middle], ...withMappings([first, second]) }), middle, "work-ownership");
  assertViolation(run({ ...fixture, [source]: fixture[source].replace("alpha/future-features", "solo/future-features"), ...withMappings([first, second]) }), source, "work-mapping");
  assertViolation(run({ ...fixture, ...withMappings([first, second, transfer(source, "XX-F1", destination, "SO-F3")]) }), source, "work-mapping");
  assertViolation(run({ ...withMappings([transfer(ALPHA_FEATURES, "AL-F10", destination, "SO-F3")]), [destination]: FEATURE("SO-F3") }), ALPHA_FEATURES, "work-mapping");
  assertViolation(run({ ...withMappings([transfer(source, "BL-F20", ALPHA_PROBLEMS, "AL-P1")]) }), source, "work-mapping");
});

test("retained historical pointers resolve via file/ID mappings; mappings never satisfy own entry plans", () => {
  const old = legacyDeclarations.find(e => e.file === "docs/backlog/future-features.md" && e.id === "FEAT-019");
  const destination = "docs/programs/solo/future-features.md";
  // The original pointer text is immutable, so its first destination must remain DM's file.
  const dm = "docs/programs/dependency-maintenance", target = `${dm}/future-features.md`;
  const fixture = { "docs/README.md": baseTree()["docs/README.md"] + "| `programs/dependency-maintenance` | DM | active |\n",
    [`${dm}/progress.md`]: progress(), [`${dm}/plan.md`]: DETAIL.replace("SO-U1", "DM-U1"),
    [old.file]: `# F\n\n## Closed\n\n${old.form}\n`, [target]: FEATURE("DM-F1"),
    ...withMappings([transfer(old.file, old.id, target, "FEAT-019"), transfer(target, "FEAT-019", target, "DM-F1")]),
  };
  assertClean(run(fixture));
  assertViolation(run({ ...fixture, [target]: FEATURE("FEAT-019") }), target, "work-id");
  const path = entryPath("al-f60-moved");
  assertViolation(run({ [ALPHA_FEATURES]: "# F\n\n## Closed\n\n- AL-F60 — Moved to [solo](../solo/future-features.md)\n", [destination]: FEATURE("SO-F1"),
    [path]: entryPlan("AL-F60"), ...withMappings([transfer(ALPHA_FEATURES, "AL-F60", destination, "SO-F1")]) }), path, "plan-shape");
});

test("allocation: destination-local independent sequences reserve closed/moved IDs, ignore old F/P and never fill gaps", () => {
  const issued = [{ id: "BL-F20" }, { id: "DM-F1" }, { id: "DM-F2" }, { id: "DM-P9" }, { id: "AW-F99" }];
  assert.equal(nextIdentifier("DM", "F", issued), "DM-F3");
  assert.equal(nextIdentifier("DM", "P", [{id:"DM-001"},{id:"DM-002"}]), "DM-P1");
  assert.equal(nextIdentifier("DM", "F", [{id:"DM-F2"},{id:"DM-F4",role:"closed"}]), "DM-F5");
  assert.equal(nextIdentifier("DM", "F", [{id:"DM-F2"},{id:"DM-F4",moved:true}]), "DM-F5");
  assert.equal(nextIdentifier("DM", "F", [], [transfer(ALPHA_FEATURES,"DM-F4",ALPHA_FEATURES,"AW-F1")]), "DM-F5");
  const migratedSecurityIds = Array.from({ length: 32 }, (_, i) => ({ id: `SH-P${i + 1}` }));
  assert.equal(nextIdentifier("SH", "P", migratedSecurityIds), "SH-P33");
  for (const [code, count] of [["AW",10],["AF",6],["DM",1]]) {
    assert.equal(nextIdentifier(code,"U",Array.from({length:count},(_,i)=>({code,id:`U${i+1}`}))), `${code}-U${count+1}`);
  }
});

test("activation inventory: fixed local numbering, planned U reservations and finite legacy forms match r2", () => {
  const mappings = JSON.parse(readFileSync(new URL("./work-id-mappings.json", import.meta.url), "utf8"));
  const groups = [
    ["backlog", "F", ["FEAT-012","FEAT-013","FEAT-014","FEAT-015","FEAT-016","FEAT-022","FEAT-023","FEAT-024"], "BL"],
    ["backlog", "P", ["BL-003","BL-004","BL-006"], "BL"],
    ["programs/agent-workflow", "F", ["FEAT-007","FEAT-010","FEAT-011","FEAT-025"], "AW"],
    ["programs/agent-workflow", "P", ["AW-002","AW-008"], "AW"],
    ["programs/app-foundation", "F", ["FEAT-005"], "AF"],
    ["programs/app-foundation", "P", ["AF-001","AF-002","AF-003","BL-005"], "AF"],
    ["programs/dependency-maintenance", "F", ["FEAT-019","FEAT-020"], "DM"],
    ["programs/dependency-maintenance", "P", ["BL-009"], "DM"],
    ["programs/security-hotfix", "P", [...Array.from({ length: 31 }, (_, i) => `P${i + 1}`), "AW-003"], "SH"],
  ];
  let count = 0;
  for (const [home, kind, ids, code] of groups) {
    const file = `docs/${home}/${kind === "F" ? "future-features" : "problems"}.md`;
    ids.forEach((id, i) => {
      assert.deepEqual(mappings.filter(m => m.from.file === file && m.from.id === id), [transfer(file,id,file,`${code}-${kind}${i+1}`)]);
      count++;
    });
  }
  assert.equal(count, 57);
  for (let n = 2; n <= 6; n++) assert.ok(mappings.some(m => m.from.id === `U${n}` && m.to.id === `AF-U${n}`));
  assert.ok(mappings.some(m => m.from.file.endsWith("/u10-task-naming/plan.md") && m.to.file.endsWith("/aw-u10-task-naming/plan.md") && m.to.id === "AW-U10"));
  assert.equal(new Set(legacyDeclarations.map(e => `${e.file}#${e.id}#${e.role}`)).size, legacyDeclarations.length);
  assert.ok(legacyDeclarations.every(e => e.file && e.id && e.role && e.form && e.reason));
  assert.deepEqual(legacyDeclarations.filter(e => e.role === "problem-row"), []);
  assert.equal(legacyDeclarations.filter(e => e.role === "plan-title").length, 19);
  const sh = "docs/programs/security-hotfix/problems.md";
  const canonical = readFileSync(new URL(`../../${sh}`, import.meta.url), "utf8");
  const ids = [...canonical.matchAll(/^(?:### |[-*+] )(SH-P[1-9][0-9]*)(?::| —)/gm)].map(match => match[1]);
  for (let n = 1; n <= 32; n++) {
    const required = `SH-P${n}`;
    assert.equal(ids.filter(id => id === required).length, 1, `${required} must retain exactly one declaration`);
  }
  const historical = legacyDeclarations.filter(e => e.file.startsWith("docs/programs/security-hotfix/"));
  assert.deepEqual(historical.map(e => [e.file, e.role]), [
    ["docs/programs/security-hotfix/plan.md", "legacy-plan"],
    ["docs/programs/security-hotfix/plan-h2.md", "legacy-plan"],
  ]);
  const originalPointer = mappings.filter(m => m.from.file === "docs/programs/agent-workflow/problems.md" && m.from.id === "AW-003");
  assert.deepEqual(originalPointer, [transfer("docs/programs/agent-workflow/problems.md", "AW-003", sh, "AW-003")]);
});

test("H4–H6 cannot hide legacy, new canonical or duplicate entry declarations", () => {
  for (const level of [4, 5, 6]) {
    const prefix = "#".repeat(level);
    for (const [file, entry, legacy, fresh, duplicate, header] of [
      [ALPHA_PROBLEMS, OPEN_ENTRY, "ALPHA-999", "AL-P2", "AL-P1", "###"],
      [ALPHA_FEATURES, FEATURE, "FEAT-999", "AL-F2", "AL-F10", "##"],
    ]) {
      const current = baseTree()[file];
      const append = (body) => file === ALPHA_PROBLEMS
        ? current.replace("\n## Resolved", "\n" + body + "\n## Resolved")
        : current + "\n" + body;
      for (const id of [legacy, fresh]) {
        assertViolation(run({ [file]: append(entry(id).replace(header, prefix)) }), file, "work-id");
      }
      const result = run({ [file]: append(entry(duplicate).replace(header, prefix)) });
      assertViolation(result, file, "work-id");
      assertViolation(result, file, "work-ownership");
    }
  }
});

test("historical unit rows reserve canonical ownership without reserving legacy F/P numbers", () => {
  const dir = "docs/programs/agent-workflow", file = `${dir}/README.md`;
  const row = legacyDeclarations.find(e => e.file === file && e.role === "unit-row" && e.id === "U1").form;
  const charter = CHARTER.replace("| GA-U1 First | `b1` |", row);
  const fixture = {
    "docs/README.md": baseTree()["docs/README.md"] + "| `programs/agent-workflow` | AW | evergreen |\n",
    [`${dir}/progress.md`]: progress(), [file]: charter,
  };
  assertClean(run(fixture));
  for (const rows of [row + "\n| AW-U1 Duplicate | `b2` |", "| AW-U1 Duplicate | `b2` |\n" + row]) {
    assertViolation(run({ ...fixture, [file]: charter.replace(row, rows) }), file, "work-ownership");
  }
  const problem = legacyDeclarations.find(e => e.file === `${dir}/problems.md` && e.id === "AW-004").form;
  const feature = legacyDeclarations.find(e => e.file === `${dir}/future-features.md` && e.id === "FEAT-021").form;
  assertClean(run({ ...fixture, [file]: charter.replace(row, row + "\n| AW-U11 New work | `b2` |"),
    [`${dir}/problems.md`]: problems(OPEN_ENTRY("AW-P4"), problem),
    [`${dir}/future-features.md`]: FEATURE("AW-F21") + "\n## Closed\n\n" + feature + "\n",
  }));
});
