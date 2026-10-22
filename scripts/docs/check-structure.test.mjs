// Test plan:
// - Goal: check that the structure checker blocks only the shape rules stated in the `program-docs` skill and
//   passes docs that follow its templates.
// - Type: Node CLI black-box tests on temporary fixture trees built from the skill's templates.
// - Subject: `scripts/docs/check-structure.mjs`.
// - Passing cases: a tree that follows the templates exits 0; every rule ID has a passing fixture next to its
//   failing one; the security-hotfix allowlist passes exactly the two stated path and rule pairs.
// - Failing cases: every rule ID (file-role, progress-state, milestone-format, this-commit, problems-shape,
//   no-state-in-plan, plan-progress-link, future-features-shape, backlog-shape, backlog-not-program,
//   programs-index, adr-index) has a fixture that exits 1 and names the right `file:line [rule-id]`; the
//   allowlist is per path and per rule; bad usage or a missing root exits 2.
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

const DETAIL = "# U1 detail plan\n\n## 1. Binding Spec\n\n## 6. Progress\n\nCurrent State and milestones: [progress.md](progress.md).\n";

function baseTree() {
  return {
    "docs/README.md": README(["| `programs/alpha` | active |", "| `programs/solo` | closed |"]),
    "docs/programs/alpha/plan.md": "# Master plan — Alpha\n\n## 1. Goal\n\n- Goal: g.\n",
    "docs/programs/alpha/progress.md": progress(),
    "docs/programs/alpha/problems.md": problems(OPEN_ENTRY("ALPHA-001"), "- ALPHA-000 — Resolved 2026-01-01: done (abc1234)."),
    "docs/programs/alpha/implementation-plans/u1/plan.md": DETAIL.replace("(progress.md)", "(../../progress.md)"),
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

test("a program is found by its progress.md in any folder", () => {
  const result = run({
    "docs/legacy/x/progress.md": progress(),
    "docs/legacy/x/plan.md": DETAIL,
    "docs/legacy/x/notes.md": "# Notes\n",
  });
  assertViolation(result, "docs/legacy/x/notes.md", "file-role", 1);
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
  assertClean(run({ [file]: problems(OPEN_ENTRY("ALPHA-001") + "\n\n" + OPEN_ENTRY("ALPHA-002"), "") }));
});

test("no-state-in-plan: State sections fail, similar headings and a one-line pointer pass", () => {
  const file = "docs/programs/alpha/plan.md";
  assertViolation(run({ [file]: "# Master plan\n\n## State\n\nWe are on step 3.\n" }), file, "no-state-in-plan", 3);
  assertViolation(run({ [file]: "# Master plan\n\n## 4. Current State\n\nText.\n" }), file, "no-state-in-plan", 3);
  assertClean(run({ [file]: "# Master plan\n\n## State transitions\n\nText.\n\n## Statement\n\nText.\n" }));
  assertClean(run({ [file]: "# Master plan\n\n## State\n\nSee [progress.md](progress.md).\n" }));
  assertViolation(run({ [file]: "# Master plan\n\n## State\n\nSee [progress.md.bak](progress.md.bak).\n" }), file, "no-state-in-plan", 3);
});

test("plan-progress-link: a root detail plan needs a progress link, a master plan does not", () => {
  const solo = "docs/programs/solo/plan.md";
  assertViolation(run({ [solo]: "# Detail plan\n\n## 1. Binding Spec\n" }), solo, "plan-progress-link", 1);
  assertViolation(run({ [solo]: "# Detail plan\n\nProgress: `progress.md`.\n" }), solo, "plan-progress-link", 1);
  assertClean(run({ [solo]: "# Detail plan\n\nProgress: [progress][p].\n\n[p]: progress.md\n" }));
  const unit = "docs/programs/alpha/implementation-plans/u1/plan.md";
  assertViolation(run({ [unit]: "# U1\n\n## 1. Binding Spec\n" }), unit, "plan-progress-link", 1);
  assertClean(run({ "docs/programs/alpha/plan.md": "# Master plan\n\n## 1. Goal\n\n- Goal: g.\n" }));
});

test("a root plan.md is a master plan only while the program has implementation-plans", () => {
  const withUnits = run({ "docs/programs/solo/implementation-plans/u1/plan.md": DETAIL.replace("(progress.md)", "(../../progress.md)"), "docs/programs/solo/plan.md": "# Master plan\n" });
  assertClean(withUnits);
});

test("future-features-shape: heading, fields and IDs unique across all files", () => {
  const file = "docs/programs/alpha/future-features.md";
  assertViolation(run({ [file]: "# F\n\n## A loose idea\n" }), file, "future-features-shape", 3);
  assertViolation(run({ [file]: "# F\n\n## FEAT-010: Idea\n\n- Status: Deferred.\n- Direction: d.\n" }), file, "future-features-shape", 3);
  assertViolation(run({ [file]: `# F\n\n${FEATURE("FEAT-001")}` }), "docs/backlog/future-features.md", "future-features-shape", 3);
  assertViolation(run({ [file]: `# F\n\n${FEATURE("FEAT-010")}${FEATURE("FEAT-010")}` }), file, "future-features-shape");
  assertViolation(run({ [file]: "# F\n\n## Closed\n\n- FEAT-020 — Fixed it\n" }), file, "future-features-shape", 5);
  assertClean(run({ [file]: `# F\n\n${FEATURE("FEAT-010")}${FEATURE("FEAT-011")}` }));
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

test("security-hotfix allowlist: two files, one rule each, nothing else", () => {
  const hotfix = {
    "docs/README.md": README(["| `programs/alpha` | active |", "| `programs/solo` | closed |", "| `programs/security-hotfix` | closed |"]),
    "docs/programs/security-hotfix/plan.md": DETAIL,
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
    "docs/programs/other/plan.md": DETAIL,
    "docs/programs/other/plan-h2.md": "# Plan H2\n",
    "docs/programs/other/progress.md": progress(),
    "docs/programs/other/problems.md": "# Problems\n\n| # | Problem |\n| --- | --- |\n| P1 | text |\n",
  };
  const result = run(moved);
  assertViolation(result, "docs/programs/other/plan-h2.md", "file-role", 1);
  assertViolation(result, "docs/programs/other/problems.md", "problems-shape");
});

test("unknown arguments and a missing root exit 2", () => {
  assert.equal(spawnSync(process.execPath, [scriptPath, "--bogus", "x"], { encoding: "utf8" }).status, 2);
  assert.equal(spawnSync(process.execPath, [scriptPath, "--root", join(tmpdir(), "does-not-exist-docs-check")], { encoding: "utf8" }).status, 2);
});
