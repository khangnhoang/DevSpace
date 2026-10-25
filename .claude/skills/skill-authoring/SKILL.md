---
name: skill-authoring
description: "How a DevSpace skill or reference under .claude/skills/ is created, changed, split, maintained, reviewed and audited, where an instruction belongs (skill, reference, rule, loop, ADR or program doc), the skill-shape check and the read-only instruction audit. Use when adding, editing, splitting, reviewing or maintaining a skill or reference, when deciding where a new rule goes, or when auditing the agent instructions."
---

# Skill authoring

## Use when / do not use when

Use when a task creates, changes, splits, reviews or maintains a `SKILL.md` or a file under `.claude/skills/<name>/references/`, decides where a new instruction belongs, fixes a `docs:check` skill-shape failure, or audits the agent instructions.

Do not use it to follow a skill, to edit program docs (`program-docs`), or to change `CLAUDE.md`, `.claude/rules.md` or `docs/agent-loops.md` for a reason that is not a skill move. When a new skill or a permission change is involved, `.claude/rules.md` section 8 and section 4 decide; this skill adds no permission of its own.

## Related rules owned elsewhere

These rules about skills have an owner that is not this skill. Read the owner, do not copy it here.

- The ownership split: the header of `.claude/rules.md` and the opening paragraph of `docs/agent-loops.md`.
- Precedence of a skill over the loops: `docs/agent-loops.md`, Precedence and safety.
- Language of skills, rules and docs: `.claude/rules.md` section 1 (Owner and language).
- Skills an implementor loads: `.claude/rules.md` section 2 (Roles).
- Moving a durable rule out of memory: `.claude/rules.md` section 7 (Memory).
- Reading matching skills: `CLAUDE.md`, Core engineering rules, rule 6.
- Skills and the tooling they describe: infrastructure master plan, Owner decisions, decision 9 (`docs/programs/infrastructure/plan.md`).

## Choosing where an instruction goes

Each rule has one owner: `.claude/rules.md` owns roles and permissions, `docs/agent-loops.md` owns timing and stop rules, skills own procedures. Do not restate another owner's rule; link to it by file and section name (not by line number, which moves).

Placement is decided by load time. `CLAUDE.md` and the files it imports load in every session, so they hold only what applies to nearly every task: `CLAUDE.md` the project facts (stack, commands, code map, roadmap) and the core engineering rules, `.claude/rules.md` roles, permissions, language and memory, `docs/agent-loops.md` the shared lifecycle (sizing, planning, checkpoint, review, PR and CI, stop rules). A procedure for one kind of task goes to the skill or reference that owns that task. Then choose:

| The instruction is | Put it in |
| --- | --- |
| a procedure for one kind of task that an existing skill already covers | that skill: extend it, or add a reference when the detail is situational |
| situational detail for part of a skill (only some uses need it) | a reference of that skill, linked with a read condition |
| a new kind of task that no skill covers and that recurs | a new skill (gated by `.claude/rules.md` section 8) |
| who may do what, or a permission | `.claude/rules.md` section 4 (never a skill) |
| when to plan, review, stop or wait, shared by every task | `docs/agent-loops.md` |
| a decision that outlives one program or spans programs | an ADR (`program-docs`) |
| state, plans or open problems of a program | the program's docs (`program-docs`) |

Detail that only one skill uses goes in that skill's `references/`, never in a new skill folder.

## What a skill holds

A skill holds the process, the project's choices and boundaries, and the repo-specific pitfalls that the tool cannot describe itself (for example "validate on the server without a schema library" in `server-actions`). It does not hold syntax or API behavior the agent can read from types, docs or a run. The test for a line is whether removing it would change what the agent does. Two exceptions: version-specific behavior the agent is likely to get wrong on the version in `package.json` (state the pitfall and where to check it, not the docs), and a tool agents do not know (the vendored `playwright-cli`).

A skill states only what DevSpace has today. Tooling that does not exist yet is named once as deferred, with no steps, and the steps arrive in the PR that adds the tooling.

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

## Writing

1. Read the owning docs and the nearby skills for the convention before writing; match their structure and names.
2. Write the `description` for triggering: the verbs and objects a request would contain, and the folder path or tool when there is one.
3. Put what every use needs in `SKILL.md`; link situational detail from a reference with a read condition in the linking sentence or table row.
4. Link to another owner's rule instead of restating it; name the file and section.
5. Run the verification below.

## Vendored skills

A vendored third-party skill (`playwright-cli`) keeps its upstream body byte for byte, except the frontmatter `description` and one DevSpace block under the H1. The DevSpace block wins over that body, and the length signal applies to the block. Its `references/` and `LICENSE` stay identical to upstream (compare with `git hash-object`). To update it, follow the provenance line in its DevSpace block.

## Maintaining

When a fact a skill states changes (a command, a path, a tool, a rule):

1. Edit the owner of the fact, not a copy.
2. Find every pointer to it with `rg` (the old name, path, command or section number) across `CLAUDE.md`, `.claude/`, `docs/` and `README.md`, and fix each one that is now false. Earlier detail plans are historical and stay as they are.
3. Remove steps for tooling that no longer exists.
4. Run the verification below.

A skill whose description or scope changes gets the description check.

## Description check

The description decides whether a session loads the skill. After writing or changing one, list a few requests that should load it and a few that should not, and compare with the descriptions of the skills that overlap it. Fix the description (or the overlap) until the lists come out right. A fresh session given a matching request is the real test; it is a judgment check, not a test in CI.

## Auditing the instructions

A read-only audit classifies every instruction by owner and shape and proposes moves. Read [audit.md](references/audit.md) before running or reporting one. An audit edits nothing; moving what it flags is a separate task.

## Verify

Run `npm run docs:check` after every skill or reference edit, and `npm run docs:check:test` when the checker (`scripts/docs/check-skills.mjs`) changes. Report the results. The check enforces only the required rules above; whether a skill says the right thing is your judgment.

## Resources

| Resource | Read when | Skip when |
| --- | --- | --- |
| [skill.md](references/templates/skill.md) | writing a new skill | editing an existing skill |
| [reference.md](references/templates/reference.md) | writing a new reference | editing an existing reference |
| [audit.md](references/audit.md) | auditing the agent instructions, or a task asks where existing instructions belong | writing or editing one skill |

## Checklist

- [ ] the instruction is in its owner; others link to it by file and section name
- [ ] required shape rules pass (`npm run docs:check`); recommended conventions were not forced on an existing skill
- [ ] every reference is linked with a read condition
- [ ] pointers to anything that moved were found with `rg` and fixed
- [ ] the description was checked against overlapping skills
- [ ] `.claude/rules.md` section 8 was followed; no permission text was copied into a skill
