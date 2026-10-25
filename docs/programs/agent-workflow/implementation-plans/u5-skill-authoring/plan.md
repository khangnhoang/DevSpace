# U5 detail plan — Skill authoring skill and the skill-shape check

Revision: r7, 2026-10-26 (r7 answers Codex plan round 5: AC1 measures length without a pass or fail, the FEAT-005 fact, an example the repo has today; r6 by Owner decision D10: the length rule becomes a principle with a review signal of about 200 lines, and the content principle; r5 answers Codex plan round 3: the audit links to the existing approval rules instead of stating one, D9 is a placement criterion that moves nothing in U5, the shape-break class names its rule ID; r4 by Owner decisions D8 and D9: the audit reference and the load-time placement rule; r3 answers Codex plan round 1: the skill-shape rule table with frontmatter syntax, report locations and link matching, `tsc` in the code checks, the fixture reads the real template, the reference count; r2 by Owner decisions D6 and D7: the skill links to the skill rules owned elsewhere, and the template records the current section conventions as recommendations). Owner approval: r7 2026-10-26, after Codex plan gate PASS in round 6. Master plan or charter: [charter](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: one project skill, `skill-authoring`, owns how a DevSpace skill or reference is created, changed, split, maintained, reviewed and audited, and where an instruction belongs. `.claude/rules.md` section 8 keeps only the permission lines and points to it. `npm run docs:check` fails when a skill breaks a mechanical shape rule that `skill-authoring` states. The docs catch-up from PR 21 ships in the same PR.

| ID | Observable result |
| --- | --- |
| AC1 | `.claude/skills/skill-authoring/SKILL.md` exists with frontmatter `name: skill-authoring` and a `description` that names creating, changing, splitting, reviewing and maintaining a skill or reference under `.claude/skills/`. It has a `## Use when / do not use when` section, follows its own template (AC4), and is reviewed under D10: its `wc -l` is reported as information, and above about 200 lines the review looks for content to move into a reference; the count alone never fails AC1. |
| AC2 | `.claude/rules.md` section 8 holds exactly two rules: a new skill, or a skill change that widens a permission, needs the Owner's decision; no skill can widen section 4. Plus one line saying that `skill-authoring` owns the procedure. None of the other current section 8 rules (location, one owner per rule, "only what DevSpace has today", length, frontmatter, Use when, read conditions, `docs:check`, vendored skills) remains in `.claude/rules.md`; each appears in `skill-authoring` with its meaning kept, except the length rule, which appears as reworded by D10 (Main compares them line by line against section 8 at the baseline). |
| AC3 | `skill-authoring` states, beyond the moved rules: (a) how to choose between a new skill, a reference, extending an existing skill, or a rule, loop, ADR or program doc, linking to section 8 for the Owner's decision on a new skill instead of restating it, with the load-time placement rule (D9): `CLAUDE.md` and the files it imports load in every session, so they hold only what applies to nearly every task — `CLAUDE.md` the project facts (stack, commands, code map, roadmap) and the core engineering rules, `.claude/rules.md` roles, permissions, language and memory, `docs/agent-loops.md` the shared lifecycle (sizing, planning, checkpoint, review, PR and CI, stop rules) — and a procedure for one kind of task goes to the skill or reference that owns that task; (b) maintenance when a fact changes: edit its owner, find every pointer to it with `rg`, and remove steps for tooling that no longer exists; (c) a description check: list a few requests that should load the skill and a few that should not, and compare with the descriptions of overlapping skills; (d) verification: `npm run docs:check` after every skill edit, and `npm run docs:check:test` when the checker changes; (e) one section that links, without restating, to every skill rule owned elsewhere: the ownership split (`.claude/rules.md` header, `docs/agent-loops.md` line 3), precedence over the loops (`docs/agent-loops.md`, Precedence), English (`.claude/rules.md` section 1), which skills an implementor must load (section 2), a durable rule moves from memory into its owning skill as a `chore(agent-rules): ...` commit (section 7), reading each matching skill completely (`CLAUDE.md` rule 6), and a skill changing in the same PR as the tooling it describes (infrastructure master plan decision 9); (f) the D10 content principle: a skill holds the process, the project's choices and boundaries, and the repo-specific pitfalls that the tool cannot describe itself (for example "validate on the server without a schema library" in `server-actions` today), not syntax or API behavior the agent can read from types, docs or a run; the test for a line is whether removing it would change what the agent does; two exceptions: version-specific behavior the agent is likely to get wrong on the version in `package.json` (state the pitfall and where to check it, not the docs), and a tool agents do not know (the vendored `playwright-cli`). |
| AC4 | `skill-authoring/references/templates/` holds a skill template `skill.md` and a reference template `reference.md` (never a file named `SKILL.md`, which could be loaded as a skill), each linked from `SKILL.md` with a read condition. The templates and `SKILL.md` mark the current section conventions as recommended, not required: a `## Resources` table with "Read when" and "Skip when" (or a read condition in the sentence that links the reference), a `## Checklist`, `## Stop when` where a skill has hard stops, a frontmatter `description` that states what the skill covers and then a "Use …" sentence (when, before, after or for what), and a reference whose first paragraph after the H1 is a "Read this …" sentence saying when to read it. A skill copied from the template with its placeholders filled passes the skill-shape check: the test reads `skill-authoring/references/templates/skill.md` itself, fills its placeholders and writes it into the temporary tree, so a broken template fails the test. |
| AC5 | `npm run docs:check` runs a skill-shape check over every `.claude/skills/<dir>/`. A folder without `SKILL.md`, frontmatter missing or unparsable, a `name` that differs from the folder name, an empty `description`, a missing `## Use when / do not use when` heading, or a file under `references/` that `SKILL.md` does not link to each gives `file:line [rule-id] message` on stderr and exit 1. A tree that follows the rules exits 0; bad usage or a missing root exits 2. The rule IDs, conditions and report locations are the table below. Each rule ID has a failing and a passing fixture in a test run by `npm run docs:check:test`. |
| AC6 | `playwright-cli` passes the check only through the allowlist entry for `skill-use-when` (table below), with a reason (the vendored body keeps its layout; its DevSpace block carries "Use when" and "Do not use when"). No other entry is added, and every current skill passes. |
| AC7 | Pointers that the move makes false are corrected: the agent-workflow charter invariants that cite section 8, the `docs:check` invariant (it now enforces what `program-docs` or `skill-authoring` states), and the infrastructure master plan invariant that cites section 8 for "states only tooling that exists". Earlier detail plans (agent-workflow U4, infrastructure U4) are historical and stay as they are. `rg "section 8" --glob '!**/implementation-plans/**'` shows no pointer to a moved rule. |
| AC8 | A fresh session given "add a reference to server-actions for upload limits" loads `skill-authoring`, and one given "fix the logout menu bug" does not. Main runs both and reports the result; this is a check of the description, not a test in CI. |
| AC9 | The docs catch-up from PR 21 is in the PR: agent-workflow State no longer says U4 delivery is in progress, the U4 CP6 milestone cites `30b27dc`, a milestone records the U4 merge, AW-006 and BL-007 are resolved lines. |
| AC10 | `skill-authoring/references/audit.md` exists, is linked from `SKILL.md` with a read condition, and gives a read-only audit procedure: (1) scope: `CLAUDE.md`, `.claude/rules.md`, `docs/agent-loops.md`, every project `SKILL.md` and reference (the vendored `playwright-cli` body only for its DevSpace block); (2) for each instruction, one classification: in place; belongs elsewhere under AC3 (a) and D9 (name the owner); duplicate or restatement of another owner (name it); states tooling that does not exist; shape break, reported with its AC5 rule ID and subject to the AC6 allowlist (an AC4 recommendation is never a shape break); provenance unknown (no Owner decision or commit found, AW-007); (3) a report table with `file:line`, the classification, the proposed owner and the reason; every proposed move is only a proposal, and the reference links to `.claude/rules.md` section 4 (anything the Owner has not asked for in words) and section 6 (one question per decision) for how a move is approved, restating neither (G1); (4) the audit edits nothing, and a Codex run of it uses the `code-review` Codex brief. No audit is run in U5 (D8). |

Skill-shape rules (AC5). Every path is repo-relative; `<skill>` is `.claude/skills/<dir>/SKILL.md`. Only the direct children of `.claude/skills/` are skills.

| Rule ID | Fails when | Reported at |
| --- | --- | --- |
| `skill-file` | a directory directly under `.claude/skills/` has no `SKILL.md` | `.claude/skills/<dir>/SKILL.md:1` |
| `skill-frontmatter` | line 1 is not `---`; no closing `---`; a line between them is not `key: value` with `key` matching `[a-z][a-z0-9-]*`; a key appears twice; a value starts with `"` and is not one double-quoted string, with no `"` or backslash inside, closed at the end of the same line | `<skill>`, line of the bad line (line 1 when the block is missing or unclosed) |
| `skill-name` | `name` is missing, or its value (unquoted when double-quoted) differs from `<dir>` | `<skill>`, line of `name`, or 1 when missing |
| `skill-description` | `description` is missing, or its value is empty after unquoting and trimming | `<skill>`, line of `description`, or 1 when missing |
| `skill-use-when` | no line outside fenced code is exactly `## Use when / do not use when` | `<skill>:1` |
| `skill-reference-link` | a file (any extension) anywhere under `<dir>/references/` is not the target of a link in `<skill>`. A link counts when it is an inline `[text](target)` or a reference-style definition `[id]: target` outside fenced code, whose target, with any `#fragment` removed and resolved against the folder of `<skill>`, is that file | the unlinked file, line 1 |

Other frontmatter keys (for example `allowed-tools`) are allowed and not checked. Values are single-line; YAML block scalars, lists and single quotes are rejected by `skill-frontmatter`. The only allowlist entry is the pair `.claude/skills/playwright-cli/SKILL.md` and `skill-use-when`; a fixture shows that the other rules still apply to that file.

### 1.2 Scope and non-goals

- In scope: the new skill, its templates and its audit reference; trimming section 8; the skill-shape check with its tests and npm wiring; pointer fixes in AC7; the charter row, decision 3 and the FEAT-009 line; the PR 21 docs catch-up.
- Non-goals: running the audit of AC10 or moving any instruction it would flag (D8: a later initiative, with AW-007); enforcing the recommended conventions of AC4 or reshaping existing skills to them (D7); moving any rule of AC3 (e) out of its owner (D6); an eval harness or automated trigger tests (the Owner ruled it out, 2026-10-25); a mechanical length limit (the length stays a review judgment); rewriting other skills beyond what the check forces; changing permissions in section 4; editing the vendored `playwright-cli` body; changing `.github/workflows/` (CI already runs `npm run docs:check` and `docs:check:test`).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The two permission rules stay in `.claude/rules.md`; the skill links to them and never restates them. | A skill becomes a second owner of a permission and the two drift (section 8 forbids a skill widening section 4). |
| G2. Every moved rule keeps its meaning; nothing is dropped or softened in the move. The only intended change of meaning is the length rule, by D10. | A rule the Owner approved silently disappears (AW-007). |
| G3. The check enforces only what `skill-authoring` states as required, and `skill-authoring` names every rule the check enforces; a recommended convention is never checked. | The check and the skill disagree, as the charter `docs:check` invariant forbids. |
| G4. The `playwright-cli` body and references stay byte for byte (`git hash-object` equal to the baseline). | The vendored-skill rule is broken by the very initiative that moves it. |
| G5. The check is a Node script with tests on temporary fixture trees; a test reads nothing from the real `.claude/` except the skill template it copies (AC4), and the checker under test runs only on the temporary tree. | Tests pass or fail because of the repo's current skills instead of the rule. |

### 1.4 Owner decisions that bind this unit

- D1 (2026-10-25): DevSpace gets a skill that owns how skills and references are written, maintained and upgraded; the procedural rules of section 8 move into it, so there is no copy. Recorded as charter decision 3; it replaces the D4 reason for dropping `maintain-repo-skills` (FEAT-009), which was about Codex-only governance.
- D2 (2026-10-25): the skill is named `skill-authoring`.
- D3 (2026-10-25): the mechanical skill-shape check is built in this initiative, inside `npm run docs:check`.
- D4 (2026-10-25): the Codex gate runs on this plan and on the implementation diff.
- D5 (2026-10-25): no eval harness; VocaSpace's Codex CLI harness is not brought over.
- D6 (2026-10-25): skill rules owned elsewhere (roles, language, precedence, memory, timing with tooling) stay with their owners; `skill-authoring` links to them in one place.
- D7 (2026-10-25): the current section conventions are written down as recommendations in the skill and its templates, not as checked rules.
- D8 (2026-10-26): U5 writes the audit reference; running the audit and moving the instructions it flags is a later agent-workflow initiative, together with AW-007.
- D9 (2026-10-26): placement is decided by load time: the always-loaded files (`CLAUDE.md` and its imports) hold only what applies to nearly every task, split as in AC3 (a); a procedure for one kind of task goes to a skill or reference. Claude Code mechanics that belong to a role stay with the roles in `.claude/rules.md`. D9 is the criterion an audit classifies by and proposes moves with; apart from the section 8 move of AC2, every instruction keeps its current owner in U5 (for example `.claude/rules.md` sections 3, 7 and 9 and the `CLAUDE.md` Commands), until the Owner decides each move in the later initiative.
- D10 (2026-10-26): `SKILL.md` holds only what every use of the skill needs, and situational detail goes to a reference with a read condition; about 200 lines is a review signal to look for content to move into references, a chosen number and not a technical limit, never checked by a machine. A skill holds the process, the project's choices and boundaries and the repo-specific pitfalls, not what the tool documents itself (AC3 (f)). This replaces "about 150 lines" of section 8, which had no stated basis beyond "agents skip long skills" (U1 risk table).

## 2. Repository facts

Baseline: `4fa5731`, checked 2026-10-25.

- `.claude/rules.md` section 8 has five bullets; only the fourth ("A new skill, or one that widens a permission, needs the Owner's decision. No skill can widen section 4.") is about permission. The header of `rules.md` says it owns roles and permissions and that skills own procedures — justifies AC2.
- `scripts/docs/check-structure.mjs` checks only program docs against `program-docs`; nothing checks skill frontmatter, the Use-when section or reference links — justifies AC5.
- `scripts/docs/check-links.mjs` already scans `.claude/` for broken relative links — the new check need not repeat link resolution, only that each reference is linked.
- All ten skills have frontmatter `name` equal to the folder and a `description`; nine have `## Use when / do not use when`; `playwright-cli` has its Use-when text in the DevSpace block under the H1 instead — justifies AC6.
- Every file under every `references/` folder is linked from its `SKILL.md` (checked by a shell loop at the baseline) — the check passes the current tree without edits to other skills.
- `.github/workflows/ci.yml:61-62` runs `npm run docs:check` and `npm run docs:check:test` — no workflow change is needed.
- Pointers to section 8 outside detail plans: `docs/programs/agent-workflow/README.md:21-22` and `docs/programs/infrastructure/plan.md:42` — justifies AC7.
- Skill rules outside section 8: `.claude/rules.md` header and `docs/agent-loops.md:3` (ownership split), `docs/agent-loops.md:7` (a more specific skill wins over the loops), `.claude/rules.md` sections 1, 2 and 7, `CLAUDE.md` rule 6, `docs/programs/infrastructure/plan.md:30` (decision 9) — justifies AC3 (e).
- "About 150 lines" entered in the first agent-workflow plan (`5e08863`, U1 AC3), justified only by the risk row "skills too long or vague, so agents skip them", with no Owner decision number; the project skills are 51 to 122 lines today, `playwright-cli` excluded; FEAT-005 (`docs/backlog/future-features.md`) plans to extend `server-actions` with Zod, `frontend-workflow` with React Hook Form and shadcn, and `frontend-design` to use shadcn components — justifies D10.
- Section conventions in the ten skills: `## Resources` in 7 (`server-actions` and `supabase-migration` give read conditions inline, `playwright-cli` none), `## Checklist` or `## Final check` in 7, `## Stop when` in 2, `## Red flags` in 1 (`planning`); every frontmatter `description` has a sentence starting "Use " (four of them "Use when"); outside `playwright-cli` there are 28 reference files: the 20 that are not templates open with a "Read this …" sentence on the line after the H1, and the 8 `program-docs` templates open with a template comment — justifies AC4 and D7.
- The handoff memory `aw-006-handoff` lists the PR 21 catch-up items — justifies AC9; Main applied them to the state records while writing this plan (`.claude/rules.md` section 2).

## 3. Bounded implementation hypotheses

- A new `scripts/docs/check-skills.mjs` with `check-skills.test.mjs`, chained into `docs:check` and `docs:check:test` in `package.json`, with the same output format, exit codes and allowlist shape as `check-structure.mjs` — may instead be a section of `check-structure.mjs` if AC5, G3 and G5 hold.
- The check scans only the direct children of `.claude/skills/`, so a template under `references/templates/` is never treated as a skill.
- Frontmatter read by a small line parser for the syntax in the rule table (no YAML dependency) — may change if the table's accept and reject cases hold and no dependency is added.
- `SKILL.md` sections: Use when; Related rules (AC3 e); Choosing where a rule goes; Shape; Writing; Vendored skills; Maintaining; Description check; Verify; Resources; Checklist — order and titles may change if AC1 to AC4 hold.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | `skill-authoring` with its templates and the audit reference; section 8 trimmed to the two permission rules and the pointer; AC7 pointers fixed. | `npm run docs:check`; Main's line-by-line meaning check of section 8 at `4fa5731` against the skill (AC2, G2); `wc -l`. |
| CP2 | Skill-shape check, tests, `package.json` wiring, the `playwright-cli` allowlist entry; the charter `docs:check` invariant names `skill-authoring`. | `npm run docs:check`, `npm run docs:check:test`, `npm run lint`, `npx tsc --noEmit`; a temporary broken skill in a fixture fails with the right `file:line [rule-id]`; `git hash-object` of `playwright-cli` files equals the baseline (G4). |
| CP3 | Description check (AC8) and the whole-diff self-review; Codex diff gate. | Two fresh sessions as in AC8; `npm run docs:check`, `npm run docs:check:test`, `npm run lint`, `npx tsc --noEmit` (reused from CP2 only if no script or config changed since, with the reason stated); Codex PASS. |

The Sonnet implementor does CP1 and CP2 with a local commit per checkpoint and updates State in each. Main runs AC8 and the Codex gate in CP3.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A recommended convention reads as required, so agents reshape existing skills or reviewers block on it. | AC4 and D7 wording; the check ignores them (G3); the skill says existing skills are not reshaped for them. |
| A moved rule loses meaning or becomes softer. | G2 and the line-by-line check in CP1; Codex diff gate. |
| `skill-authoring` restates `rules.md` or `program-docs` instead of linking. | G1; the self-review greps for the permission lines and the program-docs rules in the new skill. |
| The check is stricter than the skill states, or blocks a future skill shape the Owner wants. | G3; each rule ID is named in the skill; a new exception goes through the allowlist with a reason. |
| The description fails to trigger, so agents keep editing skills without it. | AC8 check; the description lists concrete verbs and the folder path. |

- Rollout runbook: none (no hosted or Owner step; CI already runs the commands).
- Stop when: a moved rule cannot keep its meaning outside `rules.md`; the check would fail a current skill for a rule the Owner has not stated; a fix needs a permission change.
- Rollback: revert the PR; nothing outside the repo changes.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
