// Test plan:
// - Goal: check that the skill-shape checker blocks only the required rules stated in the `skill-authoring`
//   skill (Shape) and passes skills that follow them.
// - Type: Node CLI black-box tests on temporary fixture trees.
// - Subject: `scripts/docs/check-skills.mjs`.
// - Passing cases: a tree of valid skills exits 0; every rule ID has a passing fixture next to its failing
//   one; a skill written from the real `skill-authoring` skill template, with its placeholders filled, passes;
//   the playwright-cli allowlist passes exactly the pair `skill-use-when` and nothing else; `skill-work-id`
//   passes placeholders (`<CODE>-P<n>`), unit identifiers, checkpoint labels and test-row labels, skips the
//   vendored playwright-cli files and honors an exemption for one file and one identifier only.
// - Failing cases: every rule ID (skill-file, skill-frontmatter, skill-name, skill-description, skill-use-when,
//   skill-reference-link, skill-work-id) has a fixture that exits 1 and names the right `file:line [rule-id]`; bad usage or a
//   missing root exits 2.
// - Invariant: the result depends only on the fixture tree. The one read of the real `.claude/` is the skill
//   template, which a test fills and writes into the temporary tree; the checker runs only on that tree.
// - Last verified with: `npm run docs:check:test`.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("./check-skills.mjs", import.meta.url),
);
const templatePath = fileURLToPath(
  new URL(
    "../../.claude/skills/skill-authoring/references/templates/skill.md",
    import.meta.url,
  ),
);

const USE_WHEN = "## Use when / do not use when";
const skill = ({
  name = "alpha",
  description = '"Does alpha. Use when alpha."',
  body = `# Alpha\n\n${USE_WHEN}\n\nUse when alpha.\n`,
} = {}) =>
  [
    "---",
    ...(name === null ? [] : [`name: ${name}`]),
    ...(description === null ? [] : [`description: ${description}`]),
    "---",
    "",
    body,
  ].join("\n");
const path = (dir, rest = "SKILL.md") => `.claude/skills/${dir}/${rest}`;
const SKILL = (dir) => path(dir);

function baseTree() {
  return {
    [SKILL("alpha")]: skill(),
    [SKILL("beta")]: skill({
      name: "beta",
      body: `# Beta\n\n${USE_WHEN}\n\nSee [one](references/one.md) and [two][t].\n\n[t]: references/deep/two.md#part\n`,
    }),
    [path("beta", "references/one.md")]: "# One\n",
    [path("beta", "references/deep/two.md")]: "# Two\n",
    ".claude/skills/README.md": "not a skill\n",
  };
}

function run(overrides = {}, args = null) {
  const files = { ...baseTree(), ...overrides };
  const root = mkdtempSync(join(tmpdir(), "check-skills-"));
  try {
    for (const [file, content] of Object.entries(files)) {
      if (content === null) continue;
      const full = join(root, file);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
    const result = spawnSync(
      process.execPath,
      [scriptPath, ...(args ?? ["--root", root])],
      { encoding: "utf8" },
    );
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function assertViolation(result, file, rule, line) {
  assert.equal(result.status, 1, result.stderr);
  const escaped = file.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  assert.match(
    result.stderr,
    new RegExp(`^${escaped}:${line ?? "\\d+"} \\[${rule}\\] `, "m"),
  );
}

function assertClean(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Skill shape violations: 0\./);
}

test("a tree of valid skills exits 0; only direct children of .claude/skills are skills", () => {
  assertClean(run());
  assertClean(
    run({
      [path("alpha", "references/templates/SKILL.md")]: "no frontmatter\n",
      [SKILL("alpha")]: skill({
        body: `${USE_WHEN}\n\n[t](references/templates/SKILL.md)\n`,
      }),
    }),
  );
});

test("skill-file: a folder without SKILL.md fails at line 1, a folder with it passes", () => {
  assertViolation(
    run({ [path("gamma", "notes.md")]: "x\n" }),
    SKILL("gamma"),
    "skill-file",
    1,
  );
  assertViolation(
    run({ [path("gamma", "references/a.md")]: "x\n" }),
    SKILL("gamma"),
    "skill-file",
    1,
  );
  assertClean(
    run({
      [path("gamma", "notes.md")]: "x\n",
      [SKILL("gamma")]: skill({ name: "gamma" }),
    }),
  );
});

test("skill-frontmatter: block, line syntax, duplicate keys and quoting", () => {
  const bad = (text) => run({ [SKILL("alpha")]: text });
  assertViolation(
    bad(`# Alpha\n\n${USE_WHEN}\n`),
    SKILL("alpha"),
    "skill-frontmatter",
    1,
  );
  assertViolation(
    bad(`\n---\nname: alpha\n---\n${USE_WHEN}\n`),
    SKILL("alpha"),
    "skill-frontmatter",
    1,
  );
  assertViolation(
    bad(`---\nname: alpha\ndescription: d\n\n${USE_WHEN}\n`),
    SKILL("alpha"),
    "skill-frontmatter",
    1,
  );
  assertViolation(
    bad(`---\nname: alpha\nBad Key: x\ndescription: d\n---\n${USE_WHEN}\n`),
    SKILL("alpha"),
    "skill-frontmatter",
    3,
  );
  assertViolation(
    bad(`---\nname: alpha\ndescription: d\n- item\n---\n${USE_WHEN}\n`),
    SKILL("alpha"),
    "skill-frontmatter",
    4,
  );
  assertViolation(
    bad(`---\nname: alpha\nname: alpha\ndescription: d\n---\n${USE_WHEN}\n`),
    SKILL("alpha"),
    "skill-frontmatter",
    3,
  );
  assertViolation(
    bad(`---\nname: alpha\ndescription: "open\n---\n${USE_WHEN}\n`),
    SKILL("alpha"),
    "skill-frontmatter",
    3,
  );
  assertViolation(
    bad(`---\nname: alpha\ndescription: "a" b\n---\n${USE_WHEN}\n`),
    SKILL("alpha"),
    "skill-frontmatter",
    3,
  );
  assertViolation(
    bad(`---\nname: alpha\ndescription: "a \\" b"\n---\n${USE_WHEN}\n`),
    SKILL("alpha"),
    "skill-frontmatter",
    3,
  );
  assertViolation(
    bad(`---\nname: alpha\ndescription: 'single'\n---\n${USE_WHEN}\n`),
    SKILL("alpha"),
    "skill-frontmatter",
    3,
  );
  assertViolation(
    bad(`---\nname: alpha\ndescription: >\n  folded\n---\n${USE_WHEN}\n`),
    SKILL("alpha"),
    "skill-frontmatter",
    3,
  );
  assertViolation(
    bad(
      `---\nname: alpha\ndescription: d\nallowed-tools: [a, b]\n---\n${USE_WHEN}\n`,
    ),
    SKILL("alpha"),
    "skill-frontmatter",
    4,
  );
  assertViolation(
    bad(`---\nname: alpha\ndescription: d\nkey: {a: b}\n---\n${USE_WHEN}\n`),
    SKILL("alpha"),
    "skill-frontmatter",
    4,
  );
  assertClean(
    bad(
      `---\nname: alpha\ndescription: plain text: with colon\nallowed-tools: Bash(x:*)\n---\n${USE_WHEN}\n`,
    ),
  );
  assertClean(
    bad(
      `---\r\nname: alpha\r\ndescription: "quoted: ok"\r\n---\r\n${USE_WHEN}\r\n`,
    ),
  );
});

test("skill-name: missing or different from the folder fails; a quoted equal name passes", () => {
  assertViolation(
    run({ [SKILL("alpha")]: skill({ name: "other" }) }),
    SKILL("alpha"),
    "skill-name",
    2,
  );
  assertViolation(
    run({ [SKILL("alpha")]: skill({ name: null }) }),
    SKILL("alpha"),
    "skill-name",
    1,
  );
  assertViolation(
    run({ [SKILL("alpha")]: skill({ name: '"other"' }) }),
    SKILL("alpha"),
    "skill-name",
    2,
  );
  assertClean(run({ [SKILL("alpha")]: skill({ name: '"alpha"' }) }));
});

test("skill-description: missing or empty fails, quoted whitespace fails, text passes", () => {
  assertViolation(
    run({ [SKILL("alpha")]: skill({ description: null }) }),
    SKILL("alpha"),
    "skill-description",
    1,
  );
  assertViolation(
    run({ [SKILL("alpha")]: skill({ description: "" }) }),
    SKILL("alpha"),
    "skill-description",
    3,
  );
  assertViolation(
    run({ [SKILL("alpha")]: skill({ description: '""' }) }),
    SKILL("alpha"),
    "skill-description",
    3,
  );
  assertViolation(
    run({ [SKILL("alpha")]: skill({ description: '"   "' }) }),
    SKILL("alpha"),
    "skill-description",
    3,
  );
  assertClean(run({ [SKILL("alpha")]: skill({ description: "plain text" }) }));
});

test("skill-use-when: the exact heading outside code is required", () => {
  assertViolation(
    run({ [SKILL("alpha")]: skill({ body: "# Alpha\n" }) }),
    SKILL("alpha"),
    "skill-use-when",
    1,
  );
  assertViolation(
    run({ [SKILL("alpha")]: skill({ body: "# Alpha\n\n## Use when\n" }) }),
    SKILL("alpha"),
    "skill-use-when",
    1,
  );
  assertViolation(
    run({
      [SKILL("alpha")]: skill({
        body: "# Alpha\n\n### Use when / do not use when\n",
      }),
    }),
    SKILL("alpha"),
    "skill-use-when",
    1,
  );
  assertViolation(
    run({
      [SKILL("alpha")]: skill({
        body: `# Alpha\n\n\`\`\`\n${USE_WHEN}\n\`\`\`\n`,
      }),
    }),
    SKILL("alpha"),
    "skill-use-when",
    1,
  );
  assertClean(
    run({
      [SKILL("alpha")]: skill({
        body: `# Alpha\n\n\`\`\`\ncode\n\`\`\`\n\n${USE_WHEN}\n`,
      }),
    }),
  );
});

test("skill-reference-link: every file under references/ must be linked from SKILL.md", () => {
  const ref = path("beta", "references/deep/two.md");
  assertViolation(
    run({ [path("beta", "references/extra.md")]: "x\n" }),
    path("beta", "references/extra.md"),
    "skill-reference-link",
    1,
  );
  assertViolation(
    run({ [path("beta", "references/data.json")]: "{}\n" }),
    path("beta", "references/data.json"),
    "skill-reference-link",
    1,
  );
  assertViolation(
    run({ [path("beta", "references/deep/more/three.md")]: "x\n" }),
    path("beta", "references/deep/more/three.md"),
    "skill-reference-link",
    1,
  );
  const unlinked = skill({
    name: "beta",
    body: `${USE_WHEN}\n\n[one](references/one.md)\n`,
  });
  assertViolation(
    run({ [SKILL("beta")]: unlinked }),
    ref,
    "skill-reference-link",
    1,
  );
  const inCode = skill({
    name: "beta",
    body: `${USE_WHEN}\n\n[one](references/one.md)\n\n\`[two](references/deep/two.md)\`\n\n\`\`\`\n[two](references/deep/two.md)\n\`\`\`\n`,
  });
  assertViolation(
    run({ [SKILL("beta")]: inCode }),
    ref,
    "skill-reference-link",
    1,
  );
  const otherSkill = skill({
    name: "beta",
    body: `${USE_WHEN}\n\n[one](references/one.md) [two](../alpha/SKILL.md)\n`,
  });
  assertViolation(
    run({ [SKILL("beta")]: otherSkill }),
    ref,
    "skill-reference-link",
    1,
  );
  const external = skill({
    name: "beta",
    body: `${USE_WHEN}\n\n[one](references/one.md) [two](https://x.test/references/deep/two.md)\n`,
  });
  assertViolation(
    run({ [SKILL("beta")]: external }),
    ref,
    "skill-reference-link",
    1,
  );
  const inline = skill({
    name: "beta",
    body: `${USE_WHEN}\n\n[one](references/one.md#a) [two](./references/deep/two.md)\n`,
  });
  assertClean(run({ [SKILL("beta")]: inline }));
  const paren = skill({
    name: "beta",
    body: `${USE_WHEN}\n\n[one](references/one.md) [two](references/deep/two.md) [p](references/a(v2).md) [s](<references/a b.md>)\n`,
  });
  assertClean(
    run({
      [path("beta", "references/a(v2).md")]: "x\n",
      [path("beta", "references/a b.md")]: "x\n",
      [SKILL("beta")]: paren,
    }),
  );
  assertClean(
    run({
      [path("beta", "references/templates/skill.md")]: "x\n",
      [SKILL("beta")]: skill({
        name: "beta",
        body: `${USE_WHEN}\n\n[a](references/one.md)\n[b]: references/deep/two.md\n[c]: <references/templates/skill.md>\n`,
      }),
    }),
  );
});

test("skill-reference-link rejects multiline code, invalid fence closes and bare delimiters", () => {
  const ref = path("alpha", "references/a.md");
  const examples = [
    "Text `example\n[a](references/a.md)\n` end.",
    "```md\nexample\n``` trailing text\n[a](references/a.md)\n```",
    "](references/a.md)",
  ];
  for (const example of examples) {
    const body = `${USE_WHEN}\n\n${example}\n`;
    assertViolation(
      run({ [ref]: "# A\n", [SKILL("alpha")]: skill({ body }) }),
      ref,
      "skill-reference-link",
      1,
    );
    assertClean(
      run({
        [ref]: "# A\n",
        [SKILL("alpha")]: skill({ body: `${body}\n[a](references/a.md)\n` }),
      }),
    );
  }
});

test("playwright-cli allowlist: skill-use-when only, every other rule still applies", () => {
  const vendored = (extra = {}) => ({
    [SKILL("playwright-cli")]: skill({
      name: "playwright-cli",
      body: "# Browser Automation\n\nUse when: in the DevSpace block.\n",
    }),
    ...extra,
  });
  assertClean(run(vendored()));
  assertViolation(
    run(
      vendored({
        [SKILL("playwright-cli")]: skill({
          name: "playwright-cli",
          description: '""',
          body: "# B\n",
        }),
      }),
    ),
    SKILL("playwright-cli"),
    "skill-description",
    3,
  );
  assertViolation(
    run(
      vendored({
        [SKILL("playwright-cli")]: skill({ name: "other", body: "# B\n" }),
      }),
    ),
    SKILL("playwright-cli"),
    "skill-name",
    2,
  );
  assertViolation(
    run(vendored({ [path("playwright-cli", "references/x.md")]: "x\n" })),
    path("playwright-cli", "references/x.md"),
    "skill-reference-link",
    1,
  );
  assertViolation(
    run({ [SKILL("alpha")]: skill({ body: "# Alpha\n" }) }),
    SKILL("alpha"),
    "skill-use-when",
    1,
  );
  const copy = run({
    ...vendored(),
    [SKILL("playwright-cli-copy")]: skill({
      name: "playwright-cli-copy",
      body: "# C\n",
    }),
  });
  assertViolation(copy, SKILL("playwright-cli-copy"), "skill-use-when", 1);
  assert.doesNotMatch(copy.stderr, /playwright-cli\/SKILL\.md/);
});

test("skill-work-id: a canonical or legacy feature or problem identifier fails, with file and line", () => {
  const withText = (text) =>
    run({ [SKILL("alpha")]: skill({ body: `${USE_WHEN}\n\n${text}\n` }) });
  // line 8 holds the text: 4 frontmatter lines, a blank, the heading, a blank, then the text
  for (const id of ["BL-F4", "AW-P12", "P5", "FEAT-012", "AW-001"]) {
    assertViolation(
      withText(`See ${id} for details.`),
      SKILL("alpha"),
      "skill-work-id",
      8,
    );
  }
  assertViolation(
    withText("In prose (P28)."),
    SKILL("alpha"),
    "skill-work-id",
    8,
  );
});

test("skill-work-id: text in inline code and in a code fence is scanned too", () => {
  assertViolation(
    run({
      [SKILL("alpha")]: skill({ body: `${USE_WHEN}\n\nUse \`BL-F4\` here.\n` }),
    }),
    SKILL("alpha"),
    "skill-work-id",
    8,
  );
  assertViolation(
    run({
      [SKILL("alpha")]: skill({
        body: `${USE_WHEN}\n\n\`\`\`ts\nknownBug("P28", "x");\n\`\`\`\n`,
      }),
    }),
    SKILL("alpha"),
    "skill-work-id",
    9,
  );
});

test("skill-work-id: a reference file is reported with its own path and line", () => {
  const body = `${USE_WHEN}\n\n[one](references/one.md)\n`;
  const result = run({
    [SKILL("beta")]: skill({ name: "beta", body }),
    [path("beta", "references/one.md")]:
      "# One\n\nfirst line\nrule kept (P3)\n",
  });
  assertViolation(
    result,
    path("beta", "references/one.md"),
    "skill-work-id",
    4,
  );
});

test("skill-work-id passes placeholders, unit identifiers, checkpoint labels and test-row labels", () => {
  const text =
    "Use <CODE>-P<n> and <CODE>-F<n>, a unit <CODE>-U<n> or BL-U3, checkpoint CP1, row F12 and [E2].";
  assertClean(
    run({ [SKILL("alpha")]: skill({ body: `${USE_WHEN}\n\n${text}\n` }) }),
  );
});

test("skill-work-id skips the vendored playwright-cli body and references", () => {
  const body =
    "# Browser Automation\n\nUse when: in the DevSpace block. P5 and BL-F4 upstream.\n\n[a](references/a.md)\n";
  assertClean(
    run({
      [SKILL("playwright-cli")]: skill({ name: "playwright-cli", body }),
      [path("playwright-cli", "references/a.md")]: "P5 BL-F4\n",
    }),
  );
});

test("skill-work-id: an exemption covers one file and one identifier, not the whole file", () => {
  const template =
    ".claude/skills/program-docs/references/templates/detail-plan.md";
  const docs = skill({
    name: "program-docs",
    body: `${USE_WHEN}\n\n[t](references/templates/detail-plan.md)\n`,
  });
  assertClean(
    run({
      [SKILL("program-docs")]: docs,
      [template]: "titled INF-F1 detail plan\n",
    }),
  );
  const second = run({
    [SKILL("program-docs")]: docs,
    [template]: "titled INF-F1 detail plan\nand P5 too\n",
  });
  assertViolation(second, template, "skill-work-id", 2);
  assert.doesNotMatch(second.stderr, /INF-F1 is a feature/);
  // the same identifier in another file is not exempt
  assertViolation(
    run({ [SKILL("alpha")]: skill({ body: `${USE_WHEN}\n\nINF-F1\n` }) }),
    SKILL("alpha"),
    "skill-work-id",
    8,
  );
});

test("the skill-authoring template, with its placeholders filled, passes", () => {
  const filled = readFileSync(templatePath, "utf8")
    .replace(/<skill-name>/g, "demo")
    .replace(/<[^<>\n]+>/g, "text");
  assertClean(run({ [SKILL("demo")]: filled }));
  // the template as copied (placeholders unfilled) is not a valid skill, so the fixture does test the template
  assert.equal(
    run({ [SKILL("demo")]: readFileSync(templatePath, "utf8") }).status,
    1,
  );
});

test("a missing .claude/skills folder exits 0; unknown arguments and a missing root exit 2", () => {
  assertClean(
    run({
      [SKILL("alpha")]: null,
      [SKILL("beta")]: null,
      [path("beta", "references/one.md")]: null,
      [path("beta", "references/deep/two.md")]: null,
      ".claude/skills/README.md": null,
      "other.txt": "x\n",
    }),
  );
  assert.equal(
    spawnSync(process.execPath, [scriptPath, "--bogus", "x"], {
      encoding: "utf8",
    }).status,
    2,
  );
  assert.equal(
    spawnSync(
      process.execPath,
      [scriptPath, "--root", join(tmpdir(), "does-not-exist-skills-check")],
      { encoding: "utf8" },
    ).status,
    2,
  );
});
