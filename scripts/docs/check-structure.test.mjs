// Test plan:
// - Goal: check that the structure checker blocks only the shape rules stated in the `program-docs` skill and
//   passes docs that follow its templates.
// - Type: Node CLI black-box tests on temporary fixture trees built from the skill's templates.
// - Subject: `scripts/docs/check-structure.mjs`.
// - Passing cases: a tree that follows the templates exits 0; every rule ID has a passing fixture next to its
//   failing one; the security-hotfix allowlist passes exactly the three stated path and rule pairs.
// - Failing cases: loose IDs outside a valid entry, a closed future-features line with the wrong prefix, a
//   duplicate FEAT ID in a file outside programs and backlog, a plan that links another program's progress.md,
//   a progress.md outside docs/programs not treated as a program; every rule ID (file-role, progress-state, milestone-format, this-commit, problems-shape,
//   no-state-in-plan, plan-progress-link, plan-shape, future-features-shape, backlog-shape, backlog-not-program,
//   programs-index, adr-index) has a fixture that exits 1 and names the right `file:line [rule-id]`; the
//   allowlist is per path and per rule; bad usage or a missing root exits 2.
// - Evergreen programs: the Programs lifecycle `evergreen` selects a charter README.md (title, five sections,
//   Initiatives table) and initiative plans checked against that table; a root plan.md, a missing charter, a bad
//   title, sections, IDs and a README.md in a delivery program each fail with the right rule.
// - Invariant: the result depends only on the fixture tree, never on the real docs/.
// - Last verified with: `npm run docs:check:test`.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
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

const README = (rows) =>
  ["# Docs", "", "## Programs", "", "| Path | Lifecycle |", "| --- | --- |", ...rows, ""].join("\n");

const DETAIL_SECTIONS = ["1. Binding Spec", "2. Repository facts", "3. Bounded implementation hypotheses", "4. Checkpoints", "5. Risks, rollout and rollback", "6. Progress"];
const MASTER_SECTIONS = ["1. Goal and outcome", "2. Owner decisions", "3. Shared invariants", "4. Units", "5. Order and rollout gates", "6. Program risks", "7. Out of scope"];
const sections = (titles) => titles.map((title) => `## ${title}\n`).join("\n");
const DETAIL = `# Solo detail plan — one unit\n\n${sections(DETAIL_SECTIONS)}\nCurrent State and milestones: [progress.md](progress.md).\n`;
const UNIT_DETAIL = DETAIL.replace("# Solo detail plan", "# U1 detail plan").replace("(progress.md)", "(../../progress.md)");
const UNIT_PATH = "docs/programs/alpha/implementation-plans/u1-first/plan.md";
const UNITS_TABLE = "| Unit | Branch |\n| --- | --- |\n| U1 First | `b1` |\n";
const LEGACY_PLAN = "# Security hotfix — H1\n\n## 1. Background\n\nProgress: [progress.md](progress.md).\n";
const MASTER = `# Master plan — Alpha\n\n${sections(MASTER_SECTIONS).replace("## 4. Units\n", `## 4. Units\n\n${UNITS_TABLE}`)}`;

const CHARTER_SECTIONS = ["1. Capability and boundary", "2. Owner decisions", "3. Invariants", "4. Initiatives", "5. Opening an initiative"];
const INITIATIVES_TABLE = "| Initiative | Branch |\n| --- | --- |\n| U1 First | `b1` |\n";
const CHARTER = `# Charter — Gamma\n\n${sections(CHARTER_SECTIONS).replace("## 4. Initiatives\n", `## 4. Initiatives\n\n${INITIATIVES_TABLE}`)}`;
const GAMMA = "docs/programs/gamma";
const GAMMA_UNIT_PATH = `${GAMMA}/implementation-plans/u1-first/plan.md`;

// An evergreen program next to the base tree's alpha (master plan) and solo (single-unit) programs; the
// Programs table is replaced with one that lists it.
function evergreenTree() {
  return {
    "docs/README.md": README(["| `programs/alpha` | active |", "| `programs/solo` | closed |", "| `programs/gamma` | evergreen |"]),
    [`${GAMMA}/README.md`]: CHARTER,
    [`${GAMMA}/progress.md`]: progress(),
    [`${GAMMA}/problems.md`]: problems(OPEN_ENTRY("GAMMA-001"), "- GAMMA-000 — Resolved 2026-01-01: done (abc1234)."),
    [GAMMA_UNIT_PATH]: UNIT_DETAIL,
  };
}

function baseTree() {
  return {
    "docs/README.md": README(["| `programs/alpha` | active |", "| `programs/solo` | closed |"]),
    "docs/programs/alpha/plan.md": MASTER,
    "docs/programs/alpha/progress.md": progress(),
    "docs/programs/alpha/problems.md": problems(OPEN_ENTRY("ALPHA-001"), "- ALPHA-000 — Resolved 2026-01-01: done (abc1234)."),
    [UNIT_PATH]: UNIT_DETAIL,
    "docs/programs/alpha/future-features.md": `# Future\n\n${FEATURE("FEAT-010")}`,
    "docs/programs/solo/plan.md": DETAIL,
    "docs/programs/solo/progress.md": progress(),
    "docs/programs/solo/problems.md": problems(OPEN_ENTRY("SOLO-001"), "- SOLO-000 — Resolved 2026-01-01: done (abc1234)."),
    "docs/backlog/future-features.md": `# Backlog features\n\n${FEATURE("FEAT-001")}\n## Closed\n\n- FEAT-002 — Dropped: not needed.\n`,
    "docs/backlog/problems.md": problems(
      OPEN_ENTRY("BL-001", "Fixed locally, awaiting delivery"),
      "- BL-002 — Done: fixed the copy (PR #7)\n- BL-003 — Moved to [alpha](../programs/alpha/plan.md)\n- BL-004 — Dropped: duplicate",
    ),
    "docs/adr/README.md": "# ADRs\n\n- [one](one.md)\n",
    "docs/adr/one.md": "# One\n",
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
    run({ "docs/programs/alpha/implementation-plans/u1/progress.md": progress() }),
    "docs/programs/alpha/implementation-plans/u1/progress.md",
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
  assertViolation(run({ [file]: problems(OPEN_ENTRY("ALPHA-001").replace("\n- Exit condition: x.", ""), "") }), file, "problems-shape");
  assertViolation(run({ [file]: problems("### Something\n\n- Status: Open.", "") }), file, "problems-shape");
  assertViolation(run({ [file]: problems(OPEN_ENTRY("ALPHA-001"), "- ALPHA-001 — Resolved 2026-01-01: dup (abc1234).") }), file, "problems-shape");
  assertViolation(run({ [file]: problems(OPEN_ENTRY("ALPHA-001"), "A paragraph instead of a list line.") }), file, "problems-shape");
  assertViolation(run({ [file]: problems("- ALPHA-005: a loose line\n\n" + OPEN_ENTRY("ALPHA-001"), "") }), file, "problems-shape", 5);
  assertViolation(run({ [file]: problems(OPEN_ENTRY("ALPHA-001"), "- ALPHA-002: no em dash") }), file, "problems-shape");
  assertViolation(run({ [file]: "# Problems\n\n- ALPHA-007: before any section\n\n## Open\n\n## Resolved\n" }), file, "problems-shape", 3);
  assertClean(run({ [file]: problems(OPEN_ENTRY("ALPHA-001") + "\n\n" + OPEN_ENTRY("ALPHA-002"), "") }));
  assertClean(run({ [file]: problems("None yet.", "") }));
  // A malformed declaration after a complete entry is not swallowed as that entry's content.
  assertViolation(run({ [file]: problems(OPEN_ENTRY("ALPHA-001") + "\n\n- ALPHA-002 — Done: fixed (PR #42)", "") }), file, "problems-shape", 13);
  assertViolation(run({ [file]: problems(OPEN_ENTRY("ALPHA-001") + "\n\n- ALPHA-003: another problem", "") }), file, "problems-shape", 13);
  // References are not declarations: prose, a link, a field value and an entry body that mention IDs.
  assertClean(run({ [file]: problems("See [ALPHA-001](plan.md) and ALPHA-002 in prose.\n\n" + OPEN_ENTRY("ALPHA-001").replace("- Evidence: e.", "- Evidence: related to BL-001 and [FEAT-001](x.md)."), "") }));
  assertClean(run({ [file]: problems(OPEN_ENTRY("ALPHA-001"), "- ALPHA-000 — Resolved 2026-01-01: done, see ALPHA-001 (abc1234).") }));
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
  assertViolation(run({ [UNIT_PATH]: "# U1\n\n## 1. Binding Spec\n" }), UNIT_PATH, "plan-progress-link", 1);
  assertClean(run({ "docs/programs/alpha/plan.md": MASTER }));
});

test("plan-shape: role by title, template sections, unit IDs, folders and titles", () => {
  const master = "docs/programs/alpha/plan.md";
  const solo = "docs/programs/solo/plan.md";
  // A root plan titled as a master plan is one before implementation-plans/ exists; afterwards it must be.
  assertClean(run({ [solo]: MASTER }));
  assertViolation(run({ [master]: DETAIL }), master, "plan-shape", 1);
  // Template sections: present, titled and ordered as in the template; extra sections may follow.
  assertViolation(run({ [master]: MASTER.replace("## 3. Shared invariants\n", "") }), master, "plan-shape");
  assertViolation(run({ [master]: MASTER.replace("## 6. Program risks", "## 6. Risks") }), master, "plan-shape");
  assertViolation(run({ [solo]: DETAIL.replace("## 2. Repository facts", "## 2. Facts") }), solo, "plan-shape");
  assertClean(run({ [solo]: `${DETAIL}\n## Appendix A — notes\n` }));
  // Units table: each row starts with a unique U<n>.
  assertViolation(run({ [master]: MASTER.replace("| U1 First |", "| I1 First |") }), master, "plan-shape");
  assertViolation(run({ [master]: MASTER.replace("| U1 First | `b1` |\n", "| U1 First | `b1` |\n| U1 Again | `b2` |\n") }), master, "plan-shape");
  // Titles: a root detail plan has none, a unit detail plan has its U<n> matching folder and table.
  assertViolation(run({ [solo]: DETAIL.replace("# Solo detail plan", "# U1 detail plan") }), solo, "plan-shape", 1);
  assertViolation(run({ [UNIT_PATH]: UNIT_DETAIL.replace("# U1 detail plan", "# U2 detail plan") }), UNIT_PATH, "plan-shape", 1);
  const noSlug = "docs/programs/alpha/implementation-plans/u1/plan.md";
  assertViolation(run({ [UNIT_PATH]: null, [noSlug]: UNIT_DETAIL }), noSlug, "plan-shape", 1);
  const notInTable = "docs/programs/alpha/implementation-plans/u2-second/plan.md";
  const missing = run({ [notInTable]: UNIT_DETAIL.replace("# U1 detail plan", "# U2 detail plan") });
  assertViolation(missing, notInTable, "plan-shape", 1);
  assert.match(missing.stderr, /U2 is not a row of the master plan's Units table/);
});

const EVERGREEN = evergreenTree();
const CHARTER_FILE = `${GAMMA}/README.md`;
const gammaInitiative = (title) => UNIT_DETAIL.replace("# U1 detail plan", `# ${title} detail plan`);
const programsReadme = (gammaLifecycle) =>
  README(["| `programs/alpha` | active |", "| `programs/solo` | closed |", `| \`programs/gamma\` | ${gammaLifecycle} |`]);

test("evergreen (a): a valid evergreen program passes next to active and closed programs", () => {
  assertClean(run(EVERGREEN));
  assertClean(run({ ...EVERGREEN, [CHARTER_FILE]: `${CHARTER}\n## Appendix A — notes\n` }));
  // A charter with no initiatives yet is valid.
  assertClean(run({ ...EVERGREEN, [CHARTER_FILE]: CHARTER.replace("| U1 First | `b1` |\n", ""), [GAMMA_UNIT_PATH]: null }));
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
  assertViolation(run({ ...EVERGREEN, [CHARTER_FILE]: CHARTER.replace("| U1 First |", "| I1 First |") }), CHARTER_FILE, "plan-shape");
});

test("evergreen (g): a duplicate Initiatives ID fails", () => {
  const duplicate = CHARTER.replace("| U1 First | `b1` |\n", "| U1 First | `b1` |\n| U1 Again | `b2` |\n");
  assertViolation(run({ ...EVERGREEN, [CHARTER_FILE]: duplicate }), CHARTER_FILE, "plan-shape");
});

test("evergreen (h): an initiative plan missing from the Initiatives table fails", () => {
  const notInTable = `${GAMMA}/implementation-plans/u2-second/plan.md`;
  const missing = run({ ...EVERGREEN, [notInTable]: gammaInitiative("U2") });
  assertViolation(missing, notInTable, "plan-shape", 1);
  assert.match(missing.stderr, /U2 is not a row of the charter's Initiatives table/);
});

test("evergreen (i): an initiative whose title number differs from its folder fails", () => {
  assertViolation(run({ ...EVERGREEN, [GAMMA_UNIT_PATH]: gammaInitiative("U2") }), GAMMA_UNIT_PATH, "plan-shape", 1);
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
  assertViolation(run({ ...EVERGREEN, [GAMMA_UNIT_PATH]: "# U1 detail plan — x\n\n## 1. Binding Spec\n" }), GAMMA_UNIT_PATH, "plan-progress-link", 1);
  assertViolation(run({ ...EVERGREEN, [CHARTER_FILE]: `${CHARTER}\n## State\n\nWe are on step 3.\n` }), CHARTER_FILE, "no-state-in-plan");
});

test("future-features-shape: heading, fields and IDs unique across all files", () => {
  const file = "docs/programs/alpha/future-features.md";
  assertViolation(run({ [file]: "# F\n\n## A loose idea\n" }), file, "future-features-shape", 3);
  assertViolation(run({ [file]: "# F\n\n## FEAT-010: Idea\n\n- Status: Deferred.\n- Direction: d.\n" }), file, "future-features-shape", 3);
  assertViolation(run({ [file]: `# F\n\n${FEATURE("FEAT-001")}` }), file, "future-features-shape", 3);
  assertViolation(run({ [file]: `# F\n\n${FEATURE("FEAT-010")}${FEATURE("FEAT-010")}` }), file, "future-features-shape");
  assertViolation(run({ [file]: "# F\n\n## Closed\n\n- FEAT-020 — Fixed it\n" }), file, "future-features-shape", 5);
  assertViolation(run({ [file]: "# F\n\n## Closed\n\n- BL-020 — Dropped: wrong prefix\n" }), file, "future-features-shape", 5);
  assertViolation(run({ [file]: `# F\n\n- FEAT-030: a loose idea\n\n${FEATURE("FEAT-011")}` }), file, "future-features-shape", 3);
  const loose = "docs/notes/future-features.md";
  assertViolation(run({ [loose]: `# F\n\n${FEATURE("FEAT-001")}` }), loose, "future-features-shape", 3);
  assertViolation(run({ [loose]: "# F\n\n## FEAT-040: Idea\n\n- Status: Deferred.\n" }), loose, "future-features-shape", 3);
  assertViolation(run({ "docs/programs/solo/future-features.md": `# F\n\n${FEATURE("FEAT-001")}` }), "docs/programs/solo/future-features.md", "future-features-shape", 3);
  assertClean(run({ [loose]: `# F\n\n${FEATURE("FEAT-041")}` }));
  assertViolation(run({ [file]: `# F\n\n${FEATURE("FEAT-010", "- FEAT-050: loose after an entry")}` }), file, "future-features-shape", 8);
  assertViolation(run({ [file]: `# F\n\n${FEATURE("FEAT-010")}\n- FEAT-051 — Dropped: not under Closed` }), file, "future-features-shape");
  assertClean(run({ [file]: `# F\n\nRelated: [FEAT-001](../../backlog/future-features.md), and ALPHA-001 in prose.\n\n${FEATURE("FEAT-010", "Context: see FEAT-001.")}` }));
  assertClean(run({ [file]: `# F\n\n${FEATURE("FEAT-010")}${FEATURE("FEAT-011")}` }));
  const target = "docs/programs/beta/future-features.md";
  const moved = "# F\n\n## Closed\n\n- FEAT-060 — Moved to [beta](../beta/future-features.md)\n";
  assertClean(run({ [file]: moved, [target]: `# F\n\n${FEATURE("FEAT-060")}` }));
  assertViolation(run({ [file]: moved }), file, "future-features-shape", 5);
  const movedTwice = run({
    [file]: moved,
    [target]: `# F\n\n${FEATURE("FEAT-060")}`,
    "docs/backlog/future-features.md": moved.replace("../beta/", "../programs/beta/"),
  });
  assert.match(movedTwice.stderr, /FEAT-060 is marked moved more than once/);
});

test("backlog-shape: backlog problems and features are open with full fields or closed as one line", () => {
  const problemsFile = "docs/backlog/problems.md";
  assertViolation(run({ [problemsFile]: problems(OPEN_ENTRY("BL-001"), "- BL-002 — Resolved 2026-01-01: fixed (abc1234).") }), problemsFile, "problems-shape");
  assertViolation(run({ [problemsFile]: problems(OPEN_ENTRY("BL-001"), "- BL-002 — Done: fixed it") }), problemsFile, "problems-shape");
  assertViolation(run({ [problemsFile]: problems(OPEN_ENTRY("BL-001"), "- BL-002 — Moved to alpha") }), problemsFile, "problems-shape");
  assertViolation(run({ [problemsFile]: problems(OPEN_ENTRY("BL-001").replace("- Evidence: e.\n", ""), "") }), problemsFile, "problems-shape");
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

test("security-hotfix allowlist: three path and rule pairs, nothing else", () => {
  const hotfix = {
    "docs/README.md": README(["| `programs/alpha` | active |", "| `programs/solo` | closed |", "| `programs/security-hotfix` | closed |"]),
    "docs/programs/security-hotfix/plan.md": LEGACY_PLAN,
    "docs/programs/security-hotfix/plan-h2.md": "# Plan H2\n",
    "docs/programs/security-hotfix/progress.md": progress(),
    "docs/programs/security-hotfix/problems.md": "# Problems\n\n| # | Problem |\n| --- | --- |\n| P1 | text |\n",
  };
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
    "docs/programs/other/plan-h2.md": "# Plan H2\n",
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
