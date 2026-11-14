# AW-U14 detail plan — Durable skills and early feasibility in plans

Revision: r4, 2026-11-14. Owner approval: approved 2026-11-14 (r4). Master plan or charter: [charter](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the agent instructions hold rules that stay true as work lands. No skill cites a problem or feature entry, an inventory or a dated fact; the conflicts and false statements the 2026-11-14 instruction audit found are corrected; and four working rules that lived only in Main's memory are owned by `AGENTS.md`, `planning` and `code-review`.

| ID | Observable result |
| --- | --- |
| AC1 | `skill-authoring` (What a skill holds) says a skill or reference cites no problem or feature entry and holds no inventory, test-row range or "at the time of writing" fact: it states the rule and names the stable file or folder that is the source. The sentence that let a pitfall name its problem ID is gone. Pointers to another skill, an instruction file, an ADR, a numbered Owner decision or a unit plan stay allowed. |
| AC2 | `npm run docs:check` fails with rule `skill-work-id`, naming file and line, when a file under `.claude/skills/` contains a feature or problem identifier: a canonical `<CODE>-F<n>` or `<CODE>-P<n>`, or a legacy feature or problem identifier (such as `P<n>` or `FEAT-<n>`) that `scripts/docs/work-id-mappings.json` or `legacy-work-identifiers.json` lists as a source. Text inside inline code and code fences is scanned too. The vendored `playwright-cli` body and references are skipped; every other exemption names one file and one exact identifier, with a reason, so a different identifier in the same file still fails. Tests prove that the rule fails on each form, on an identifier inside a code fence, on a second identifier in a file that holds an exemption, and in a reference file with that file's own path and line; and that it passes on a placeholder such as `<CODE>-P<n>`, a unit identifier (`<CODE>-U<n>`), a checkpoint label (`CP1`) and a test-row label that is no listed source. Each test is proven by a mutation. |
| AC3 | Every identifier the rule reports on the baseline is removed with its rule kept, or allowlisted with a reason. The five statements the audit found false or stale are gone or reworded as a rule: the `avatars` any-path gap (two files), the RPC missing from the database, `known bug P28` "at the time of writing", "rows F1 to F11", and the list of five rls areas. The rule cannot see an inventory or a dated fact, so the implementor and Main each read every skill and reference for them and report what they removed or left, with the reason. |
| AC4 | `AGENTS.md` section 2 names no program's exception to the Codex gate. It says that an exemption from one stage of the gate (the plan round or the diff round) exists only as a numbered, dated Owner decision in the owning program's master plan or charter, which names the work and the stage it exempts; that a detail plan cites that decision and never creates one; and that no such decision exempts a migration from its review before it is applied (section 3) or a review the Owner asks for. `planning` and `supabase-migration` point to sections 2 and 3 without restating when the gate applies. Decision 11 of the techstack-migration master plan is unchanged and remains that program's exemption. Sections 4 and 8 are unchanged. |
| AC5 | The hosted migration list in `supabase-migration` (Hosted apply) and its backup reference follows Tool selection by the CP0 (b) result: the CLI command when it lists the versions without a password; the current MCP tool, with the confirmed capability gap stated once, only when the installed help shows no path that needs no database password (a path the help shows is tried first, and replaces the MCP tool when it works); and no change to those lines, with the blocker recorded in State, when the command fails for any other reason. |
| AC6 | `.claude/rules.md` section 2 says an agent definition outside the repository, at user level, does not replace the implementor session it binds. |
| AC7 | `AGENTS.md` (Tool selection) says that before an environment failure becomes a rule or a workaround, its root cause is isolated and the alternative explanations are tested, in the Owner's own shell when the agent's environment may differ. |
| AC8 | `planning` says: (a) each material assumption names its evidence and what would invalidate it; (b) a unit is sized by outcome, risk, verification, fault isolation and recovery before it is split or grouped, and shared technology alone is no reason to group; (c) every unit gives an observable result, and a feature that spans units gets a small working path first; (d) each material feasibility assumption has its check and required observation before dependent implementation starts, as the smallest trial on the intended execution path when the risk is at an integration boundary, and an unrun trial stays pending and names the work that waits; (e) a failed or blocked prerequisite is reported at once with what waits and the smallest condition to resume; (f) what an implementor does with a discovery: a detail that keeps the Spec is implemented and reported, and recorded as an accepted deviation when it departs from a hypothesis (`program-docs`, State has one owner); a discovery that would change the Spec, an Owner decision or a permission stops the work and returns to Main, and the plan is revised before work resumes; an unrelated finding is not fixed and is reported to Main for recording (`AGENTS.md` section 5); (g) the Spec binds an exact mechanism only when an alternative would break the Spec. |
| AC9 | `code-review` (Plan review) checks, for a plan with several units or checkpoints, each unit's size, the order against real prerequisites, the first checkpoint that shows the core behavior, where each feasibility assumption is tested, and that every required behavior has an owner and a reachable verification. Verification evidence is labeled by kind, including evidence limited by the environment it ran in. |
| AC10 | The examples in `AGENTS.md` section 7 and `docs/agent-loops.md` (Sizing) name no real work identifier. The implementor brief in `planning` says the plan wins over the brief, not over shared authority. |
| AC11 | `npm run docs:check` and `npm run docs:check:test` pass. No permission is widened and no skill is added. The frontend gap the audit found (no procedure for a page that reads through the API) is an open techstack-migration problem entry, not a change in this initiative. |
| AC12 | The special-case rows of `dependency-updates` hold no version number that only repeats `package.json`, `backend/package.json` or a lockfile: the row names the file that holds it. A number stays where it is the rule's own threshold (a security-fix floor, a peer range that must match), and so do the words that state a rule about pinning ("exact pin", "never a range"). The report lists each number removed and each kept, with the reason. |
| AC13 | If `test-quality-strategy/SKILL.md` is still over 200 lines on the final tree, an open agent-workflow feature entry records the split into references, to be done before the next change that adds content to that skill. At or under 200 lines, nothing is recorded. This initiative moves no content out of that skill. |

### 1.2 Scope and non-goals

- In scope: `AGENTS.md`, `.claude/rules.md`, `docs/agent-loops.md`, the project skills and references, `scripts/docs/check-skills.mjs` with its test, this program's charter row and records, and one techstack-migration problem entry.
- Non-goals: splitting `test-quality-strategy` into references (AC13 only records it); version numbers in any skill other than `dependency-updates`; references to units, ADRs and numbered decisions; the merge precondition in `pr-and-ci.md` (backlog entry for the production gate owns it); files under `~/.claude/agents`; the VocaSpace repository; a cap on self-review passes; a provenance audit (`git log -S`) of every instruction; a procedure for pages that read through the API.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Remove a state pointer, never refresh it. | "F1 to F14" is stale at the next row. |
| G2. When an identifier leaves a pitfall, the rule it explained stays, reworded to stand alone. | A security pitfall is lost with its ID. |
| G3. The rule text in `skill-authoring` and the checker change land in one commit with the removals. | `docs:check` fails on `main`, or the check and the skill disagree (charter invariant 4). |
| G4. No instruction widens a permission or restates one (`AGENTS.md` sections 4 and 8). | A skill is read as a grant. |
| G5. `planning/SKILL.md` keeps what every plan needs; rules only for multi-unit plans go to its references. | Every small plan pays for multi-unit guidance. |
| G6. The vendored `playwright-cli` body and references stay byte-identical. | The provenance check breaks. |

### 1.4 Owner decisions that bind this unit

1. (2026-11-14) Skills cite no problem or feature identifier, and `docs:check` enforces it.
2. (2026-11-14) Units of the backend migration keep Codex on the implementation diff only. A program's exception to the gate lives in that program's plan as an Owner decision, not in `AGENTS.md`.
3. (2026-11-14) The implementor stays a separate session; a user-level agent definition does not replace it. Main edits nothing under `~/.claude/agents`.
4. (2026-11-14) The rules for early feasibility and unit sizing start from the wording of the VocaSpace planning and review skills, read once with the Owner's permission, adapted to DevSpace terms.
5. (2026-11-14) Size: medium (instructions and one docs checker rule; no schema, auth, payment or permission change). This plan gets the Codex plan gate at the Owner's request, and Main reviews the diff. The techstack-migration State catch-up commit `29bf640` ships in this initiative's PR.
6. (2026-11-14) Version numbers that only repeat a package file leave the `dependency-updates` rows in this initiative. The split of `test-quality-strategy` is not done here: it is recorded for later only if the skill is still over 200 lines after this initiative.

## 2. Repository facts

Baseline: `29bf640`, checked 2026-11-14.

- `skill-authoring/SKILL.md` (What a skill holds) allows a pitfall to name its problem ID and expects the fixing change to remove it. 24 legacy identifiers remain in 13 skill files; the mappings resolve 11 of the 14 distinct ones to closed entries — justifies AC1 and AC3.
- A trial scan of `.claude/skills/` for canonical F and P identifiers reports eight tokens: three real pointers (two files) and five illustrative ones in `program-docs/SKILL.md` and its detail-plan template, which explain allocation and entry-plan naming — justifies the allowlist in AC2.
- `scripts/docs/work-identifiers.mjs` exports the canonical pattern (a whole-string match that also accepts U) and reads `legacy-work-identifiers.json`; `check-structure.mjs` reads `work-id-mappings.json` and passes it on, so the skill check must read the mappings itself. `check-skills.mjs` has an allowlist keyed by file and rule, a `report` closure bound to `SKILL.md`, and a `markCode` helper. The sources in the two JSON files include `P1` to `P31`, `FEAT-<n>`, three-digit forms such as `BL-001` and bare `U<n>` (examples; the check reads the files, not this list); no bare `F<n>` is a source, so a test-row label such as `F12` is not reported — justifies AC2 as an extension with an exemption per identifier, and the semantic read in AC3.
- `AGENTS.md` section 2 lists "the backend migration" as gated on plan and diff, then says the rest of it follows decision 11 (diff only) — justifies AC4.
- `supabase-migration/SKILL.md` (Hosted apply, step 4) and `backup-and-restore.md` name the MCP tool for the migration list, while `AGENTS.md` (Tool selection) puts a supporting CLI first — justifies AC5. Whether the CLI command runs without a database password is unverified.
- `test-quality-strategy` (Verification stages) requires the full final regression for a code or test change, and the checker and its test are code — justifies CP4.
- No test under `__tests__/` uses `knownBug` or `knownBugE2e` today; `learner-forms.spec.ts` has rows F1 to F14; `__tests__/rls/` has nine area files — justifies AC3.
- The special-case table of `dependency-updates/SKILL.md` repeats installed versions in about a dozen rows (for example the `zod`, `react-hook-form` and NestJS rows), next to numbers that are thresholds (the `postcss-selector-parser` security floor, the `@hookform/resolvers` peer range) — justifies AC12. `test-quality-strategy/SKILL.md` has 204 lines, and `skill-authoring` (Shape) names about 200 as the signal to move content into references — justifies AC13.
- Charter boundary: tooling-specific skill content that another program's unit adds stays with that program — justifies the non-goal and the entry in AC11.

## 3. Bounded implementation hypotheses

- The scan splits each line into tokens and matches each against the canonical F and P pattern and the legacy feature and problem sources — may change if AC2 still holds.
- The illustrative identifiers in `program-docs` and its detail-plan template are exempted one by one — may become placeholders if the allocation rule stays as clear.
- AC8 (a), (d), (e) and (g) apply to every plan and sit in `planning/SKILL.md`; (b) and (c) apply to work with several units and sit in `master-plan-workflow.md` and `pr-breakdown-and-brief.md`; the discovery routes of (f) sit in `pr-breakdown-and-brief.md` with the brief — placement may move if G5 holds and no rule for every plan leaves `SKILL.md`.
- The examples of AC10 become placeholders such as `<ID>` — may be worded differently if no real identifier remains.
- The new techstack-migration entry takes the next problem number of that program under the allocation rule.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP0 | Feasibility, by Main before the handoff: (a) the scan of AC2 run on the baseline, its report compared with the audit list; (b) `npx supabase migration list --linked` run once (a read-only hosted metadata read, `AGENTS.md` section 4), with no password entered. | (a) every reported token is in the audit list or the exemption candidates, and none is missed; (b) one of three results, written into the brief: the versions are listed (AC5 uses the CLI); a password prompt, after which Main reads the installed help, a supported CLI API path included, for a path without a database password: finding none, it records the confirmed gap (AC5 keeps the MCP tool); finding one, it runs that path once as the same read-only metadata read, and success means AC5 uses that command while a failure is a blocker; any other failure, which is a blocker under Tool selection, reported to the Owner, and leaves the AC5 lines unchanged. Until (b) has a result, AC5 is pending and its edits wait; nothing else waits on it. |
| CP1 | AC1 to AC3: the rule text, the checker rule and its tests, and every removal, in one commit (G3). | `npm run docs:check`, `npm run docs:check:test`, `npm run lint`; one mutation per new test; the semantic read of AC3 reported file by file. |
| CP2 | AC4 to AC7, AC10 and AC12 (the list of numbers removed and kept is part of the report). | `npm run docs:check`; a same-condition read of sections 2 and 3 against `planning` and `supabase-migration`; each of AC4 to AC7 and AC10 compared with the edited text and cited by file and section. |
| CP3 | AC8 and AC9. | `npm run docs:check`; the description check of `skill-authoring` for `planning` and `code-review`; `SKILL.md` lengths reported; each lettered item of AC8 and each check of AC9 compared with the edited text and cited by file and section. |
| CP4 | AC11 and AC13: the charter row and decision, `progress.md`, the techstack-migration entry, the line count of `test-quality-strategy/SKILL.md` on the final tree and the entry it decides, the whole-diff self-review. | The final regression of `test-quality-strategy` (Verification stages), because the checker and its test are code: `npm test` and `npm run test:e2e` unfiltered, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run docs:check`, `npm run docs:check:test`; a rerun of the audit's identifier and path checks and of the semantic read on the final tree. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The identifier rule reports text that is not an identifier | CP0 (a) runs the scan before any edit; exemptions need a reason |
| A pitfall loses its meaning with its identifier | G2; Main reads each removal in the diff review |
| `planning` grows past what a small plan needs | G5; lengths reported at CP3 |
| The new gate sentence is read as letting a plan lower its own gate | AC4: only a numbered Owner decision in the master plan or charter exempts, a detail plan never does, and migrations and Owner-requested reviews are never exempt |
| A version number that is a rule's threshold is removed with the copies | AC12 keeps thresholds and lists every number removed or kept; Main reads the list in the diff review |
| A CLI failure is taken for a capability gap | CP0 (b) separates the three results; only the installed help confirms a gap |

- Rollout runbook: after the PR merges, Main deletes the four memory files this initiative replaces and their index lines. Nothing reaches hosted except the CP0 (b) read.
- Stop when: CP0 (a) misses an audited identifier or reports text that cannot be exempted with a reason; a removal would drop a rule; an edit would widen a permission.
- Rollback: revert the PR; the checker rule and the removals revert together.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
