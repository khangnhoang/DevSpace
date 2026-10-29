// Test plan:
// - Goal: check that the link checker blocks only new broken relative markdown links and accepts the ones
//   recorded in the baseline.
// - Type: Node CLI black-box tests on temporary fixture trees, plus pure destination-reader assertions.
// - Subject: `scripts/docs/check-links.mjs`.
// - Passing cases: valid links (file, folder, fragment, external, anchor-only, links shown in code) exit 0; a
//   broken link listed in the baseline exits 0.
// - Failing cases: a broken link that is not in the baseline exits 1 and is named; a link with the wrong letter
//   case is broken; broken reference definitions (with a title or `<>`) and inline links with nested
//   parentheses are caught; bad usage exits 2; in a git work tree an ignored source is not scanned and an
//   ignored target counts as missing; a root that is not a git work tree walks the filesystem.
// - Parser regressions: multiline code spans, invalid closing fences and bare ]( cannot contribute links;
//   valid surrounding links, reference definitions, escaped/nested labels and images remain visible.
// - Invariant: the result depends only on the fixture tree and the baseline, never on the real repository.
// - Last verified with: `npm run docs:check:test`.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { extractTargets } from "./check-links.mjs";

const scriptPath = fileURLToPath(new URL("./check-links.mjs", import.meta.url));

function createFixture(files, baselineLines = []) {
  const root = mkdtempSync(join(tmpdir(), "check-links-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  const baseline = join(root, "baseline.txt");
  writeFileSync(baseline, ["# comment", ...baselineLines, ""].join("\n"));
  return { root, baseline, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function runCheck({ root, baseline }) {
  const result = spawnSync(process.execPath, [scriptPath, "--root", root, "--baseline", baseline], {
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function withFixture(files, baselineLines, check) {
  const fixture = createFixture(files, baselineLines);
  try {
    check(runCheck(fixture), fixture);
  } finally {
    fixture.cleanup();
  }
}

test("valid relative links exit 0", () => {
  withFixture(
    {
      "CLAUDE.md": "See [docs](docs/guide.md#top) and [folder](docs/sub/).\n",
      "README.md": "[rules](CLAUDE.md) [web](https://example.com/x) [mail](mailto:a@b.c) [anchor](#here)\n",
      "docs/guide.md": "Back to [root](../README.md).\n\n```md\n[sample](missing-in-code.md)\n```\n\nInline `[sample](also-missing.md)`.\n",
      "docs/sub/page.md": "[up](../guide.md)\n",
      ".claude/skills/x/SKILL.md": "[ref](references/a.md)\n",
      ".claude/skills/x/references/a.md": "# A\n",
    },
    [],
    (result) => {
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Broken links: 0 \(0 in baseline, 0 new\)/);
    },
  );
});

test("a broken link listed in the baseline is accepted", () => {
  withFixture({ "docs/old.md": "[gone](missing.md)\n" }, ["docs/old.md -> missing.md"], (result) => {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Broken links: 1 \(1 in baseline, 0 new\)/);
  });
});

test("a new broken link exits 1 and is named", () => {
  withFixture({ "docs/new.md": "[gone](missing.md)\n", "CLAUDE.md": "[gone](docs/nope.md)\n" }, [], (result) => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /NEW broken link: docs\/new\.md -> missing\.md/);
    assert.match(result.stderr, /NEW broken link: CLAUDE\.md -> docs\/nope\.md/);
  });
});

test("a broken relative link from root AGENTS.md exits 1", () => {
  withFixture({ "AGENTS.md": "[missing shared contract](docs/missing.md)\n" }, [], (result) => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /NEW broken link: AGENTS\.md -> docs\/missing\.md/);
  });
});

test("a baseline entry that is no longer broken is reported", () => {
  withFixture({ "docs/old.md": "[ok](other.md)\n", "docs/other.md": "# O\n" }, ["docs/old.md -> missing.md"], (result) => {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /no longer broken \(remove it\): docs\/old\.md -> missing\.md/);
  });
});

test("wrong letter case is a broken link", () => {
  withFixture({ "docs/a.md": "[x](Guide.md)\n", "docs/guide.md": "# G\n" }, [], (result) => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /docs\/a\.md -> Guide\.md/);
  });
});

test("reference definitions and nested parentheses are checked", () => {
  withFixture(
    {
      "docs/a.md": "[one][1] [two][2]\n\n[1]: missing-one.md \"Title\"\n[2]: <missing two.md>\n",
      "docs/b.md": "[x](missing(1).md)\n",
    },
    [],
    (result) => {
      assert.equal(result.status, 1);
      assert.match(result.stderr, /docs\/a\.md -> missing-one\.md/);
      assert.match(result.stderr, /docs\/a\.md -> missing two\.md/);
      assert.match(result.stderr, /docs\/b\.md -> missing\(1\)\.md/);
    },
  );
});

test("multiline code spans do not create broken links or reference definitions", () => {
  withFixture({ "docs/a.md": "Text `example\n[x](missing.md)\n[ref]: missing-ref.md\n` end.\n" }, [], (result) => {
    assert.equal(result.status, 0, result.stderr);
  });
});

test("a fence with trailing text does not expose example links", () => {
  withFixture({ "docs/a.md": "```md\nexample\n``` trailing text\n[x](missing.md)\n```\n" }, [], (result) => {
    assert.equal(result.status, 0, result.stderr);
  });
});

test("bare closing delimiters are not links", () => {
  withFixture({ "docs/a.md": "](missing.md)\n[label] stray ](also-missing.md)\n" }, [], (result) => {
    assert.equal(result.status, 0, result.stderr);
  });
});

test("fences close only with the same marker, enough characters and whitespace suffix", () => {
  for (const marker of ["`", "~"]) {
    const fence = marker.repeat(4);
    const other = marker === "`" ? "~~~~" : "````";
    const text = [
      `${fence}md`, "[hidden](one.md)", `${fence} text`, "[hidden](two.md)",
      marker.repeat(3), "[hidden](three.md)", other, "[hidden](four.md)",
      `   ${marker.repeat(5)} \t`, "[visible](outside.md)",
    ].join("\n");
    assert.deepEqual(extractTargets(text), ["outside.md"]);
    assert.deepEqual(extractTargets(text.replaceAll("\n", "\r\n")), ["outside.md"]);
    assert.deepEqual(extractTargets(`${fence}\n[hidden](unclosed.md)`), []);
  }
});

test("code spans require equal complete backtick runs and keep surrounding links", () => {
  assert.deepEqual(extractTargets("Before ``code `\n[x](hidden.md)\n`` after [x](visible.md)"), ["visible.md"]);
  assert.deepEqual(extractTargets("Text `` unmatched [x](visible.md) `"), ["visible.md"]);
  assert.deepEqual(extractTargets("Text \\` [x](visible.md) `"), ["visible.md"]);
  assert.deepEqual(extractTargets("Text ` code \\` [x](visible.md)"), ["visible.md"]);
  assert.deepEqual(extractTargets("[`code`](visible.md)"), ["visible.md"]);
});

test("code spans cannot hide links across blank paragraphs or fenced blocks", () => {
  assert.deepEqual(extractTargets("Text ` unmatched\n\n[x](visible.md) `"), ["visible.md"]);
  assert.deepEqual(extractTargets("Text ` unmatched\n```md\nexample\n```\n[x](visible.md) `"), ["visible.md"]);
});

test("inline links require matched unescaped label brackets", () => {
  assert.deepEqual(extractTargets("\\[literal](hidden.md) [escaped\\]](visible.md)"), ["visible.md"]);
  assert.deepEqual(extractTargets("[nested [label]](one.md) ![image](two.png) [](three.md)"), ["one.md", "two.png", "three.md"]);
  assert.deepEqual(extractTargets("[stale]\n](hidden.md) [unclosed\n\n](also-hidden.md) [real](visible.md)"), ["visible.md"]);
  assert.deepEqual(extractTargets("[first](one.md) ](hidden.md) [second](two.md)"), ["one.md", "two.md"]);
});

test("files outside docs, .claude, AGENTS.md, CLAUDE.md and README.md are not scanned", () => {
  withFixture({ "other/readme.md": "[gone](missing.md)\n", "docs/ok.md": "# Ok\n" }, [], (result) => {
    assert.equal(result.status, 0, result.stderr);
  });
});

test("bad usage and a missing baseline exit 2", () => {
  assert.equal(spawnSync(process.execPath, [scriptPath, "--bogus", "x"], { encoding: "utf8" }).status, 2);
  const fixture = createFixture({ "docs/a.md": "# A\n" });
  try {
    const result = spawnSync(process.execPath, [scriptPath, "--root", fixture.root, "--baseline", join(fixture.root, "nope.txt")], { encoding: "utf8" });
    assert.equal(result.status, 2);
  } finally {
    fixture.cleanup();
  }
});

test("in a git work tree an ignored source is not scanned and an ignored target is missing", () => {
  const fixture = createFixture({
    ".gitignore": "docs/ignored/\n",
    "docs/ignored/page.md": "[gone](missing.md)\n",
    "docs/tracked.md": "[into ignored](ignored/page.md)\n",
  });
  try {
    const init = spawnSync("git", ["init", "-q"], { cwd: fixture.root, encoding: "utf8" });
    assert.equal(init.status, 0, init.stderr);
    const result = runCheck(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /docs\/tracked\.md -> ignored\/page\.md/);
    assert.doesNotMatch(result.stderr, /docs\/ignored\/page\.md/);
  } finally {
    fixture.cleanup();
  }
});
