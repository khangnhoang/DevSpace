// Test plan: black-box fixture trees for the four-file import contract; no real runtime,
// network, database or repository mutation. Both valid examples and every forbidden edge
// must be distinguished by CLI diagnostics, with original source line numbers retained.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./check-instructions.mjs", import.meta.url));
const entry = "@AGENTS.md\n@docs/agent-loops.md\n@.claude/rules.md\n";
const valid = {
  "CLAUDE.md": entry,
  "AGENTS.md": "# Shared contract\n",
  "docs/agent-loops.md": "# Lifecycle\n",
  ".claude/rules.md": "# Claude bindings\n",
};

function fixture(overrides, check) {
  const root = mkdtempSync(join(tmpdir(), "check-instructions-"));
  try {
    for (const [path, content] of Object.entries({ ...valid, ...overrides })) {
      if (content === null) continue;
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }
    const result = spawnSync(process.execPath, [script, "--root", root], { encoding: "utf8" });
    assert.ifError(result.error);
    check(result);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("valid flat imports exit 0", () => {
  fixture({}, (result) => {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Instruction import violations: 0/);
  });
});

for (const target of ["AGENTS.md", "docs/agent-loops.md", ".claude/rules.md"]) {
  test(`missing required import ${target} exits 1`, () => {
    fixture({ "CLAUDE.md": entry.replace(`@${target}\n`, "") }, (result) => {
      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes(`[required-import] missing required import: ${target}`));
    });
  });
  test(`missing import target ${target} exits 1`, () => {
    fixture({ [target]: null }, (result) => {
      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes(`[import-target] missing import target: ${target}`));
    });
  });
}

test("a missing Claude entrypoint exits 1", () => {
  fixture({ "CLAUDE.md": null }, (result) => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /CLAUDE.md:1 \[instruction-file\]/);
  });
});

test("unexpected and repeated imports exit 1 with their lines", () => {
  fixture({ "CLAUDE.md": entry + "@extra.md\n@AGENTS.md\n", "extra.md": "# Extra" }, (result) => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /CLAUDE.md:4 \[unexpected-import\]/);
    assert.match(result.stderr, /CLAUDE.md:5 \[repeated-import\]/);
  });
});

test("a back import is rejected and reports the cycle", () => {
  fixture({ "AGENTS.md": "@CLAUDE.md\n" }, (result) => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /AGENTS.md:1 \[nested-import\]/);
    assert.match(result.stderr, /\[import-cycle\]/);
  });
});

test("nested imports fail even when the target exists and the graph is acyclic", () => {
  fixture({ ".claude/rules.md": "@extra.md\n", ".claude/extra.md": "# Extra" }, (result) => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\.claude\/rules.md:1 \[nested-import\]/);
    assert.doesNotMatch(result.stderr, /\[import-target\]|\[import-cycle\]/);
  });
});

test("a cycle between owners using relative targets is rejected", () => {
  fixture({ "AGENTS.md": "@.claude/rules.md\n", ".claude/rules.md": "@../AGENTS.md\n" }, (result) => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[import-cycle\] import cycle reaches AGENTS.md/);
  });
});

test("a self cycle is rejected", () => {
  fixture({ "docs/agent-loops.md": "@agent-loops.md\n" }, (result) => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[import-cycle\] import cycle reaches docs\/agent-loops.md/);
  });
});

test("inline and fenced import-looking examples do not create edges", () => {
  const examples = "😀 `@inline.md`\n``example\n@multiline.md\n``\n```md\n@fenced.md\n```\n~~~~md\n@tilde.md\n~~~~\n";
  fixture({ "AGENTS.md": examples, "CLAUDE.md": examples + entry.replaceAll("\n", "\r\n") }, (result) => {
    assert.equal(result.status, 0, result.stderr);
  });
});

test("examples cannot satisfy a missing required import", () => {
  fixture({ "CLAUDE.md": "`@AGENTS.md`\n```\n" + entry + "```\n" }, (result) => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[required-import\] missing required import: AGENTS.md/);
  });
});

test("a shorter fence and a closing-looking line with text remain inside the example", () => {
  fixture({ "CLAUDE.md": "````md\n```\n@short.md\n```` text\n@still-example.md\n````\n" + entry }, (result) => {
    assert.equal(result.status, 0, result.stderr);
  });
});

test("bad usage exits 2", () => {
  const result = spawnSync(process.execPath, [script, "--unknown"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});
