---
name: skill-authoring
description: "How a DevSpace skill or reference under .claude/skills/ is created, changed, split, maintained, reviewed and audited, where an instruction belongs (skill, reference, rule, loop, ADR or program doc), the skill-shape check and the read-only instruction audit including conflicts under the same conditions. Use when adding, editing, splitting, reviewing or maintaining a skill or reference, when deciding where a new rule goes, or when auditing the agent instructions."
---

# Skill authoring

## Use when / do not use when

Use when a task creates, changes, splits, reviews or maintains a skill or any file under `.claude/skills/<name>/` (including references, scripts and assets), decides where a new instruction belongs, fixes a `docs:check` skill-shape failure, or audits the agent instructions.

Do not use it to follow a skill, to edit program docs (`program-docs`), or to change `AGENTS.md`, `CLAUDE.md`, `.claude/rules.md` or `docs/agent-loops.md` for a reason that is not a skill move. When a new skill or a permission change is involved, `AGENTS.md` section 8 and section 4 decide; this skill adds no permission of its own.

## Related rules owned elsewhere

These rules about skills have an owner that is not this skill. Read the owner, do not copy it here.

- The ownership split: `AGENTS.md`, Working contract and the opening paragraph of `docs/agent-loops.md`.
- Precedence of a skill over the loops: `docs/agent-loops.md`, Precedence and safety.
- Language of skills, rules and docs: `AGENTS.md` section 1 (Owner and language).
- Skills an implementor loads: `AGENTS.md` section 2 (Roles).
- Moving a durable rule out of memory: `AGENTS.md` section 7 (Information ownership).
- Reading matching skills: `AGENTS.md`, Core engineering rules, rule 6; when and against what work they are matched: `docs/agent-loops.md`, Sizing.
- Skills and the tooling they describe: infrastructure master plan, Owner decisions, decision 9 (`docs/programs/infrastructure/plan.md`).

## Choosing where an instruction goes

Each rule has one owner: `AGENTS.md` owns shared roles and permissions, `docs/agent-models.md` owns role-to-model and effort choices across environments, `.claude/rules.md` owns Claude execution bindings, `docs/agent-loops.md` owns timing and stop rules, skills own procedures. Do not restate another owner's rule; link to it by file and section name (not by line number, which moves).

Placement is decided by load time. `AGENTS.md` holds shared project facts (stack, commands, code map, roadmap), core engineering rules, language, roles, permissions and information ownership. `CLAUDE.md` is the flat Claude entrypoint importing `AGENTS.md`, `docs/agent-loops.md` and `.claude/rules.md` directly once each; the latter holds only Claude API, UI and memory-storage bindings, with model and effort selection read from `docs/agent-models.md` when assigning roles. The shared lifecycle (sizing, planning, checkpoint, review, PR and CI, handoff, stop rules) belongs to `docs/agent-loops.md`. Source references are not automatic imports in another agent. A procedure for one kind of task goes to the skill or reference that owns that task. `npm run docs:check` validates this four-file flat import contract and relative links originating in `AGENTS.md`. It rejects missing files or required imports, unexpected or repeated imports, imports from the other three owners, and cycles; inline/fenced code examples are ignored. This is a bounded repository check, not a validator of every Claude import syntax or proof of runtime compliance. Then choose:

| The instruction is | Put it in |
| --- | --- |
| a procedure for one kind of task that an existing skill already covers | that skill: extend it, or add a reference when the detail is situational |
| situational detail for part of a skill (only some uses need it) | a reference of that skill, linked with a read condition |
| a new kind of task that no skill covers and that recurs | a new skill (gated by `AGENTS.md` section 8) |
| who may do what, or a permission | `AGENTS.md` section 4 (never a skill) |
| when to plan, review, stop or wait, shared by every task | `docs/agent-loops.md` |
| a decision that outlives one program or spans programs | an ADR (`program-docs`) |
| state, plans or open problems of a program | the program's docs (`program-docs`) |

Detail that only one skill uses goes in that skill's `references/`, never in a new skill folder.

## What a skill holds

A skill holds the process, the project's choices and boundaries, and the repo-specific pitfalls that the tool cannot describe itself (for example "never `strict` a schema for a payload that carries whole rows" in `server-actions`). It does not hold syntax or API behavior the agent can read from types, docs or a run. The test for a line is whether removing it would change what the agent does. Two exceptions: version-specific behavior the agent is likely to get wrong on the version in `package.json` (state the pitfall and where to check it, not the docs), and a tool agents do not know (the vendored `playwright-cli`).

A skill holds rules, procedures, pitfalls and pointers to stable example files, worded so they stay true as work lands. It holds no rollout or progress state: which units, forms, screens or test rows are done or still pending, unit or PR history, or the next free identifier. That state lives in the owning program's docs, and a test inventory lives in the test files (Choosing where an instruction goes). A unit edits a skill only when it changes a rule, a procedure, a pitfall or a path the skill names. A pitfall about a known defect names its problem ID, and the change that fixes the defect removes it. A skill gives no steps for tooling or code that is not on `main`: tooling that does not exist yet is named once as deferred, with no steps, and the steps arrive in the PR that adds the tooling.

## Shape

Required, and checked by `npm run docs:check` (the rule ID is in the failure line):

| Rule ID | A skill must |
| --- | --- |
| `skill-file` | have `.claude/skills/<dir>/SKILL.md` |
| `skill-frontmatter` | open with a `---` block of single-line `key: value` lines (key `[a-z][a-z0-9-]*`, no repeated key); a value that starts with `"` is one double-quoted string with no `"` or backslash inside; no YAML block scalar, list, flow list or map (`[...]`, `{...}`) or single quote |
| `skill-name` | have `name` equal to the folder name |
| `skill-description` | have a non-empty `description` |
| `skill-use-when` | have a line `## Use when / do not use when` outside code |
| `skill-reference-link` | link every file under its `references/` from `SKILL.md` (inline or reference-style link), so a reference is read when its condition holds |

Every linked reference also carries a read condition, in the linking sentence or a table row; the check cannot see that, so it is your judgment. Other frontmatter keys such as `allowed-tools` are allowed and not checked. The one exception is the vendored `playwright-cli`, which passes `skill-use-when` through an allowlist entry in `scripts/docs/check-skills.mjs` with a stated reason; a new exception goes through that allowlist with a reason.

Recommended, not checked and not a reason to reshape an existing skill: a `## Resources` table with "Read when" and "Skip when" (or the read condition in the sentence that links the reference); a `## Checklist`; a `## Stop when` where the skill has hard stops; a `description` that says what the skill covers and then a "Use ..." sentence; a reference that opens, right after its H1, with a "Read this ..." sentence saying when to read it. The templates in [skill.md](references/templates/skill.md) and [reference.md](references/templates/reference.md) follow these. Read them when you write a new skill or reference.

Length is a review judgment, not a check. `SKILL.md` holds only what every use of the skill needs; situational detail goes to a reference with a read condition. About 200 lines is a signal to look for content to move into references, a chosen number and not a technical limit.

## Shared skill ownership

`.claude/skills/` is the source of truth for all shared project skills. Create and
edit every skill file in `.claude/skills/<skill-name>/`, including `SKILL.md`,
`references/`, `scripts/` and other resources. Do not maintain a second copy or
edit through the `.agents/skills/` path.

Each shared skill has a directory symlink at `.agents/skills/<skill-name>` whose
relative target is `../../.claude/skills/<skill-name>`. Link the whole skill
directory so new resources are shared automatically. Inspect any existing
destination and preserve its content before resolving a conflict; never replace
it blindly with a link.

## Writing

1. Read the owning docs and the nearby skills for the convention before writing; match their structure and names. Create files only at the canonical path above.
2. Write the `description` for triggering: the verbs and objects a request would contain, and the folder path or tool when there is one.
3. Put what every use needs in `SKILL.md`; link situational detail from a reference with a read condition in the linking sentence or table row.
4. Link to another owner's rule instead of restating it; name the file and section.
5. For a new skill, create its corresponding directory symlink in `.agents/skills/` in the same change. Use a symlink, not a copy or a Windows junction; on Windows, enable Developer Mode and repository-local `core.symlinks=true` if needed.
6. Run the verification below.

## Vendored skills

A vendored third-party skill (`playwright-cli`) keeps its upstream body byte for byte, except the frontmatter `description` and one DevSpace block under the H1. The DevSpace block wins over that body, and the length signal applies to the block. Its `references/` and `LICENSE` stay identical to upstream (compare with `git hash-object`). To update it, follow the provenance line in its DevSpace block.

## Maintaining

When a fact a skill states changes (a command, a path, a tool, a rule):

1. Edit the owner of the fact at `.claude/skills/<skill-name>/`, not a copy or the `.agents/skills/` path. Keep the existing skill symlink unchanged.
2. Find every pointer to it with `rg` (the old name, path, command or section number) across `AGENTS.md`, `CLAUDE.md`, `.claude/`, `docs/` and `README.md`, and fix each one that is now false. Earlier detail plans are historical and stay as they are.
3. Remove steps for tooling that no longer exists.
4. Run the verification below.

A skill whose description or scope changes gets the description check.

## Description check

The description decides whether a session loads the skill. After writing or changing one, list a few requests that should load it and a few that should not, and compare with the descriptions of the skills that overlap it. Fix the description (or the overlap) until the lists come out right. A fresh session given a matching request is the real test; it is a judgment check, not a test in CI.

## Auditing the instructions

A read-only audit classifies every instruction by owner and shape, compares requirements under the same conditions and proposes corrections. Read [audit.md](references/audit.md) before running or reporting one. An audit edits nothing; correcting what it flags is a separate task.

## Verify

Run `npm run docs:check` after every skill or reference edit, and `npm run docs:check:test` when the checker (`scripts/docs/check-skills.mjs`) changes. Report the results. The check enforces only the required rules above; whether a skill says the right thing is your judgment.

After creating or editing a skill:

1. Verify the symlink exists at `.agents/skills/<skill-name>`, points to the canonical directory `.claude/skills/<skill-name>`, and the resources inside are accessible through the symlink path. Verify Git records a new link as mode `120000` when staging is authorized; otherwise report that index verification is pending.
2. Read `SKILL.md` and all supporting files through both paths and compare their contents. Check relative references within and outside the skill from both locations; paths that leave the skill must resolve to the same intended repository file. Preserve documented vendored exceptions and report them explicitly.

## Resources

| Resource | Read when | Skip when |
| --- | --- | --- |
| [skill.md](references/templates/skill.md) | writing a new skill | editing an existing skill |
| [reference.md](references/templates/reference.md) | writing a new reference | editing an existing reference |
| [audit.md](references/audit.md) | auditing the agent instructions, or a task asks where existing instructions belong | writing or editing one skill |

## Checklist

- [ ] the instruction is in its owner; others link to it by file and section name
- [ ] all skill files were created or edited at `.claude/skills/<skill-name>/`; a new skill has its directory symlink and an existing skill kept its link unchanged
- [ ] the symlink exists, points to the canonical skill directory, and its resources are accessible through the symlink path; relative references work through both paths
- [ ] required shape rules pass (`npm run docs:check`); recommended conventions were not forced on an existing skill
- [ ] every reference is linked with a read condition
- [ ] pointers to anything that moved were found with `rg` and fixed
- [ ] the description was checked against overlapping skills
- [ ] `AGENTS.md` section 8 was followed; no permission text was copied into a skill
