# U6 detail plan — Instruction audit and the AW-007 rewording

Revision: r2, 2026-10-26 (r2 answers Codex plan round 1: the AC3 pointers move into CP1, the vendored check names what stays byte for byte). Owner approval: r2 2026-10-26, after Codex plan gate PASS in round 2. Master plan or charter: [charter](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: every instruction the read-only audit flagged (Appendix A) is moved, reworded, replaced by a pointer, removed or confirmed exactly as the Owner decided item by item; `.claude/rules.md` section 2 says when Main may edit state records without reading as a ban on implementors; the always-loaded files hold only what D9 of U5 allows for the items decided here; the PR 22 docs catch-up ships in the same PR.

| ID | Observable result |
| --- | --- |
| AC1 | Codex (A2-A5). `.claude/rules.md` section 3 no longer holds the `codex exec` command, the PowerShell note, the resume mechanics or the thread-store fallback; `code-review/references/codex-brief.md` holds each of them with its meaning kept and is their only owner. Section 3 keeps: which work Codex reviews, that Codex is read-only and Main runs it and decides on its findings, the no-Codex rule for small Owner-QA fixes, and a link to `codex-brief.md`. "Codex loads neither rules nor skills; every brief starts with Read first" and "loop until PASS; ask the Owner only for a new decision" appear only in `codex-brief.md`; `code-review/SKILL.md` Codex and section 3 link to it. `codex-brief.md` no longer points to section 3 for the command or resume. |
| AC2 | Handoff (A6a, A6b). `.claude/rules.md` section 7 no longer lists what a handoff holds (hosted, git, processes, sessions, grants, lagging records, scope, later unit, after) or "links to the owning docs instead of copying them"; it keeps when Main writes a handoff, one memory file linked from `MEMORY.md`, the one-line prompt, the link to `handoff.md`, and every one-task, lifecycle and deletion rule unchanged in meaning. `handoff.md` covers every removed item. |
| AC3 | Code comments (A7). `.claude/rules.md` has no section 9 and no code-comment rule; `CLAUDE.md` Core engineering rules has a rule 13 with the four points of the old section 9 and their meaning kept. `rg -n "section 9" CLAUDE.md .claude docs README.md --glob '!**/implementation-plans/**'` returns no pointer to the old section; the two existing pointers (`code-review/references/domain-dimensions.md`, `frontend-workflow/SKILL.md` step 7) name `CLAUDE.md` rule 13. |
| AC4 | Test commands (A17, A18). `CLAUDE.md` Commands has one line each for `npm test`, `npm run test:unit` and `npm run test:e2e`: what it runs, what it needs (local stack and `db reset`; Chromium for e2e), that `test:e2e` overwrites `.next` (run `npm run build` before `npm start`), and a link to `test-quality-strategy`. Every other detail of the old lines (Vitest minimal reporter and `--reporter=default`, port 3100, never reuses a server, builds with the local stack's URL and keys, the about 180 MB first install, the network guard, the mail record, the payment rows calling actions directly, "the other server actions have no tests: verify them by commands and a manual browser pass, and report what was not verified") is in `test-quality-strategy`, added there if it is not already (G2). |
| AC5 | Main and the implementor (A9, A1, W1, A36, W2). `.claude/rules.md` section 2 states, by D6: while an implementor is active on an approved plan, Main edits nothing in the checkout, state records included, and sends every change, an Owner-requested state fix included, to that implementor; when no implementor is active, Main edits state records directly (`progress.md`, `problems.md`, `future-features.md` entries, backlog included) with no implementor, review round or Codex round and runs `npm run docs:check`; the line keeps that this covers no plans, rules, skills or code and that commit and push stay separate grants. No sentence in section 2 says or implies that only Main edits State; the implementor updating State in its checkpoint commits (U4 D8, `program-docs`) stays allowed. The old line "While an implementor owns a plan, Main does not edit the product code or the tests that plan covers" is replaced by the broader rule. The CP6 parenthesis is gone. `test-quality-strategy/references/test-plan-and-known-bugs.md` no longer says "through Main … this skill does not own state records"; it links to section 2. |
| AC6 | Language (A29, A41-A45). `.claude/rules.md` section 1 states that implementor and Codex reports to Main are in English; every restatement listed for A29 and A41-A45 in Appendix A is a link to section 1 or is dropped where a link sits beside it. |
| AC7 | Removed (A32, A34). `git-pr-workflow/SKILL.md` no longer bans `--no-verify` and no longer says "no attribution lines"; the rest of each sentence keeps its meaning. |
| AC8 | Confirmed (A10, A11, A13, A33, A53, A55). Their text is unchanged except where another AC of this plan edits the same sentence, and this plan records each as an Owner decision (D5). |
| AC9 | Pointers (A12, A14-A16, A19-A25, A30, A31, A35, A37-A39, A46-A52). Each restatement in Appendix A is replaced by a link to its owner (file and section name, no line number), or dropped where a link already sits beside it; the procedure around it in the same sentence or paragraph stays. A12: `.claude/rules.md` section 6 keeps "ask before the plan is written or sent to review, not after" and `planning` Workflow step 5 links to it. |
| AC10 | Wording (A54, W3, W4, W5, A27). `planning/references/pr-breakdown-and-brief.md` asks for a hosted metadata snapshot because the implementor cannot reach hosted, with a link to `.claude/rules.md` section 4, and no longer says the implementor cannot query the database. `frontend-design/SKILL.md` heading reads "Current stack (only what exists)". `supabase-migration/SKILL.md` Hard rules no longer has the rename-to-recorded-version sentence; the MCP ban and its H2-1 reason stay. `server-actions/SKILL.md` states the three `requireCourseAccess()` results, `{ user, course, isAdmin }`, `{ redirect }` and `{ notFound }`. `supabase-migration/references/rpc-trigger-concurrency.md` names no `handle_updated_at`; it says to reuse an existing trigger helper from the snapshot when one fits. |
| AC11 | Meaning kept (G1). Main compares every changed file line by line with `c9741e7` and lists, for each removed or moved sentence, where its meaning now lives or which Owner decision removed it; nothing outside Appendix A and AC12 changes meaning. |
| AC12 | Records. The charter has the U6 row; `progress.md` holds the PR 22 catch-up (State reconciled to U6 at the catch-up commit; the milestone that cited `(this commit)` cites `db51b04`; the milestone "U5 merged (PR 22, `c9741e7`)"); the implementor updates State in each checkpoint commit. After the merge, the catch-up resolves AW-007 to one line citing the PR. |
| AC13 | `npm run docs:check` passes (0 structure, 0 skill shape, no new broken link); `npm run docs:check:test` passes. |

### 1.2 Scope and non-goals

- In scope: the edits of AC1-AC10 in `CLAUDE.md`, `.claude/rules.md`, `docs/agent-loops.md` and the project skills and references; the charter row; the PR 22 catch-up; the U6 state records.
- Non-goals: any instruction the audit classified "in place" and the Owner did not decide on; AW-008 (`check-links.mjs` parser); the vendored `playwright-cli` body and references (only its DevSpace block may change, for A31); new rules; any change to permissions in section 4 beyond moving or linking text (G1); `scripts/docs/`, `.github/workflows/`, product code; earlier detail plans (historical).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Meaning is kept: a moved or linked rule says the same thing at its owner; only the decisions of 1.4 change meaning. A permission is never widened or narrowed by a move. | A rule the Owner approved disappears or softens silently, which is AW-007 itself. |
| G2. A restatement is removed only after its owner states the full rule; a detail the owner lacks is added to the owner first (for example the AC4 e2e details). | Removing the copy drops the only statement of a fact. |
| G3. Links name file and section, not line numbers (`skill-authoring`, Choosing where an instruction goes). | Line links go stale at the next edit. |
| G4. The `playwright-cli` body, `references/` and `LICENSE` stay byte for byte; only its DevSpace block may change (A31). | The vendored-skill rule breaks. |
| G5. Main makes no edit in the checkout while the implementor is active (D6), including state records; review corrections go to the implementor with `SendMessage`. | The implementor commits Main's uncommitted diff, the failure D6 was decided to prevent. |

### 1.4 Owner decisions that bind this unit

All dated 2026-10-26.

- D1: the audit runs first, read-only; the Owner decides each item; then Main writes this plan once with only the decided items, the section 2 rewording and the PR 22 catch-up.
- D2: Main ran the audit and Codex (read-only) cross-checked the table before the Owner decided; Codex gave PASS in round 5 (session `01a17792-e074-70d0-ba30-5293368281fb`).
- D3: the full audit table stays outside the repo; this plan records only the decided items (Appendix A).
- D4: the Codex gate runs on this plan and on the implementation diff.
- D5: confirmed as Owner decisions with their current text: A10 small fixes during Owner QA get no Codex round; A11 the four AskUserQuestion format rules; A13 a durable rule moves out of memory as a separate `chore(agent-rules): ...` commit and sits in memory as "pending move" until then; A33 no worktree whose `node_modules` is a junction or symlink; A53 no `claude/` or `agent/` branch prefix (agents, Codex once, spammed tool-named prefixes); A55 all checkpoints in one dispatch, split only when a later checkpoint needs an Owner decision based on an earlier result.
- D6: while an implementor is active on an approved plan, Main edits nothing in the checkout, state records included; even an Owner-requested state fix (for example one a previous task forgot) goes to the implementor; once the implementor is no longer active, Main edits docs freely. Reason: an implementor once committed Main's uncommitted diff with its own. This settles AW-007's wording and A36.
- D7: removed: A32 (`--no-verify` ban; the repo has no git hooks, and the PR that adds hooks adds the rule back); A34 ("no attribution lines"; the Owner's Claude Code settings already set commit and PR attribution to empty).
- D8: moves: A2-A5 to `codex-brief.md`; A6a to the handoff template; A7 to `CLAUDE.md` rule 13; A17-A18 details to `test-quality-strategy`; A29 into `.claude/rules.md` section 1.
- D9: every listed restatement becomes a link to the owner in Appendix A, or is dropped where a link sits beside it; A12 is owned by `.claude/rules.md` section 6; A54 is reworded to "hosted only".
- D10: wording: W2 drop the CP6 parenthesis; W3 the `frontend-design` heading; W4 drop the rename sentence; W5 the three `requireCourseAccess` results; A27 drop the `handle_updated_at` name.

## 2. Repository facts

Baseline: `c9741e7` (PR 22 merged), checked 2026-10-26.

- The audit procedure is `skill-authoring/references/audit.md`; `npm run docs:check` at the baseline reports 0 structure and 0 skill-shape violations and 1 baselined broken link inside the vendored `playwright-cli` body — justifies AC13 and the vendored exclusion.
- `.claude/rules.md:27-35` hold the Codex command, resume and loop lines; `codex-brief.md:3` and `:28` point back to section 3 for them — justifies AC1.
- `.claude/rules.md:83` lists the handoff contents that `program-docs/references/templates/handoff.md:12-31` also gives — justifies AC2.
- `.claude/rules.md:102-107` is section 9; it is cited from `code-review/references/domain-dimensions.md` (Security, performance and comments) and `frontend-workflow/SKILL.md` step 7 — justifies AC3.
- `test-quality-strategy/SKILL.md` already states the Vitest reporter, port 3100, the build env, the network guard, the mail record and the payment rows, but not "never reuses a server", the 180 MB install size or the instruction to verify untested actions by commands and a manual pass — justifies AC4 and G2.
- `.claude/rules.md:15` ("Main edits state records directly … No implementor") and `:22` (Main does not edit product code or tests while an implementor owns a plan); U4 D8 lets the implementor update State in its checkpoint commits; `test-plan-and-known-bugs.md:39` says to update the problem record "through Main" — justifies AC5.
- The repo has no git hook (no `.husky`, no `core.hooksPath`, only sample files in `.git/hooks`, no hook package in `package.json`) — justifies the A32 removal.
- `lib/auth.server.ts:39-42` defines `CourseAccess` with three branches; `grep -rn handle_updated_at supabase/` is empty; `.claude/rules.md:49` lets implementors run `psql` against `127.0.0.1:54322` — justify AC10.
- The `aw-007-handoff` memory lists the PR 22 catch-up items — justifies AC12; Main applies them to the state records while writing this plan (`.claude/rules.md` section 2; no implementor is active).

## 3. Bounded implementation hypotheses

- `codex-brief.md` gets a `## Running Codex` section before `## Template` with the command block, the PowerShell note, resume and the fallback; its `## Rules` keep the loop and "Read first" lines — order and titles may change if AC1 holds.
- `CLAUDE.md` rule 13 is titled "Comment the why" with the four points condensed to one or two sentences each, as rules 1-12 are — may change if AC3 and G1 hold.
- The A9 and section 2 text replaces the "Program state records" bullet and the last bullet of section 2 with one bullet that states D6 — may be split into two bullets if AC5 holds.
- AC4 details join `test-quality-strategy` "What exists" and "End-to-end" — may sit elsewhere in that skill if AC4 holds.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Always-loaded files and the rules they hand off: AC1, AC2, AC3, AC4, AC5, AC6 (section 1 part) with their owner-side additions (`codex-brief.md`, `CLAUDE.md` rule 13, `test-quality-strategy`, `test-plan-and-known-bugs.md`) and the two AC3 pointers, so CP1 leaves no stale link. | `npm run docs:check`; `rg` checks of AC1 and AC3; the line-by-line meaning list of AC11 for the files touched. |
| CP2 | Skills and references: AC6 (restatements), AC7, AC9, AC10. | `npm run docs:check`, `npm run docs:check:test`; `git hash-object` of `playwright-cli/references/*` and `playwright-cli/LICENSE` equals `c9741e7`, and `git diff c9741e7 -- .claude/skills/playwright-cli/SKILL.md` touches only the DevSpace block (G4); the AC11 list for the files touched. |
| CP3 | Main review of the whole diff and the AC11 meaning check, corrections through the implementor, then the Codex diff gate. | Codex PASS; `npm run docs:check` after the last correction. |

The Sonnet implementor does CP1 and CP2 with a local commit per checkpoint and updates State in each (U4 D8). Main runs CP3 and edits nothing while the implementor is active (G5).

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A pointer replaces a restatement whose owner says less, so a fact is lost. | G2; the AC11 list names where each removed sentence lives; Codex diff gate. |
| The new section 2 text reads as a new ban (for example on Main editing docs after the implementor stopped). | AC5 states both sides; Codex plan and diff gates read it cold. |
| A link to a moved rule is missed and points to a section that no longer holds it. | `rg` for "section 3", "section 7", "section 9" and the moved phrases in CP1 and CP2; `docs:check` for broken file links. |
| A confirmed item (D5) is edited by accident while a nearby sentence changes. | AC8; the AC11 diff list. |

- Rollout runbook: none (no hosted or Owner step).
- Stop when: a moved rule cannot keep its meaning at its owner; an owner lacks a fact and adding it would need a new decision; a change would alter a permission in section 4.
- Rollback: revert the PR; nothing outside the repo changes.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

## Appendix A. Decided audit items

Audit r5 at `c9741e7`; class and owner as in the audit; decision as in 1.4. `A<n>` are audit rows; `W<n>` are the audit's wording notes (D1-D5 in the audit table, renamed here so they cannot be read as Owner decisions). Line numbers are at the baseline.

| Item | Location | Class | Decision and owner |
| --- | --- | --- | --- |
| A1, W1 | `.claude/rules.md:15` | in place, wording | reword by D6 (AC5) |
| A2, A3 | `.claude/rules.md:27-31, 33` | belongs elsewhere | move to `codex-brief.md` (AC1) |
| A4 | `.claude/rules.md:34`, `code-review/SKILL.md:54` | duplicate | keep only in `codex-brief.md` (AC1) |
| A5 | `.claude/rules.md:35` | duplicate | keep only in `codex-brief.md` (AC1) |
| A6a | `.claude/rules.md:83` sentences 2-3 | duplicate | drop, link `handoff.md` (AC2) |
| A6b | `.claude/rules.md:85-94` | in place | unchanged (AC2) |
| A7 | `.claude/rules.md:102-107` | belongs elsewhere | move to `CLAUDE.md` rule 13 (AC3) |
| A8, W2 | `.claude/rules.md:18` parenthesis | in place, wording | drop (AC5) |
| A9 | `.claude/rules.md:22` | provenance unknown | replaced by D6 (AC5) |
| A10, A11, A13 | `.claude/rules.md:36`, `:67`, `:81` | provenance unknown | confirmed, D5 (AC8) |
| A12 | `.claude/rules.md:69`, `planning/SKILL.md:22` | duplicate | owner `rules.md` section 6; planning links (AC9) |
| A14 | `.claude/rules.md:14`, `docs/agent-loops.md:16` | duplicate | conditions in loops Sizing; section 2 links (AC9) |
| A15 | `docs/agent-loops.md:7`, `CLAUDE.md:34` | duplicate | owner `rules.md` section 4 (AC9) |
| A16 | `CLAUDE.md:37`, `git-pr-workflow/SKILL.md:40` | duplicate | owner `docs/agent-loops.md` Loop 1 (AC9) |
| A17, A18 | `CLAUDE.md:15` sentence 3, `:16` | duplicate, belongs elsewhere | details to `test-quality-strategy` (AC4) |
| A19 | `frontend-workflow/references/manual-ui-validation.md:9` emails | duplicate | owner `CLAUDE.md` Commands (AC9) |
| A20 | `code-review/references/codex-brief.md:31` sentence 1, `supabase-migration/SKILL.md:14` | duplicate | owner `rules.md` section 3 (AC9) |
| A21, A46 | `code-review/SKILL.md:14`, `program-docs/SKILL.md:14`, `planning/SKILL.md:37` | duplicate | owner `docs/agent-loops.md` Precedence (AC9) |
| A22 | `code-review/references/domain-dimensions.md:19` sentences 1-2 | duplicate | owner `test-quality-strategy` What exists (AC9) |
| A23 | `planning/references/pr-breakdown-and-brief.md:24` | duplicate | owner `rules.md` section 4 (AC9) |
| A24 | `frontend-workflow/SKILL.md:27`, `frontend-workflow/references/async-state-and-forms.md:9` | duplicate | owner `server-actions` Return contract (AC9) |
| A25 | `frontend-design/SKILL.md:16` sentence 3, `frontend-workflow/SKILL.md:20` | duplicate | owner `rules.md` section 4 (AC9) |
| A26, W3 | `frontend-design/SKILL.md:14` | in place, wording | heading reworded (AC10) |
| A27 | `supabase-migration/references/rpc-trigger-concurrency.md:19` | tooling that does not exist | drop the name (AC10) |
| A28, W4 | `supabase-migration/SKILL.md:20` sentence 3 | in place, wording | drop (AC10) |
| A29 | `code-review/references/report-format.md:21` clause 2 | provenance unknown | keep, move into `rules.md` section 1 (AC6) |
| A30 | `git-pr-workflow/SKILL.md:18` | duplicate | owner `planning` Git and approval (AC9) |
| A31 | `planning/references/qa-matrix.md:5` sentence 3, `manual-ui-validation.md:9` sign-in, `playwright-cli/SKILL.md:15` | duplicate | owner `rules.md` section 4 (AC9) |
| A32, A34 | `git-pr-workflow/SKILL.md:19` sentence 2, `:34` | provenance unknown | removed, D7 (AC7) |
| A33, A53, A55 | `git-pr-workflow/SKILL.md:20`, `:26`, `pr-breakdown-and-brief.md:23` | provenance unknown | confirmed, D5 (AC8) |
| A35 | `planning/references/pr-breakdown-and-brief.md:33` | duplicate | owner `rules.md` section 2 (AC9) |
| A36 | `test-quality-strategy/references/test-plan-and-known-bugs.md:39` | belongs elsewhere | link `rules.md` section 2, by D6 (AC5) |
| A37, A38 | `manual-ui-validation.md:9` `.env*`, `:14` sentence 2 | duplicate | owner `rules.md` section 4 (AC9) |
| A39 | `frontend-workflow/SKILL.md:20` sentence 2 clause 1, `:32` | duplicate | owner `frontend-design` Classify the screen first (AC9) |
| A40, W5 | `server-actions/SKILL.md:19` last sentence | in place, wording | three results (AC10) |
| A41-A45 | `program-docs/SKILL.md:70` sentence 1, `git-pr-workflow/SKILL.md:34, 40, 44`, `branch-and-commit.md:31`, `pr-and-ci.md:25`, `report-format.md:21` clause 1 | duplicate | owner `rules.md` section 1 (AC6) |
| A47-A49 | `master-plan-workflow.md:27`, `program-docs/SKILL.md:60` sentence 1, `pr-and-ci.md:3, 18, 29` | duplicate | owner `rules.md` section 4 (AC9) |
| A50 | `docs/agent-loops.md:9` | duplicate | owner `rules.md` section 4 (AC9) |
| A51, A52 | `master-plan-workflow.md:13`, `planning/SKILL.md:42` sentences 1 and 4 | duplicate | owner `program-docs` State has one owner, File roles (AC9) |
| A54 | `pr-breakdown-and-brief.md:26` parenthesis | belongs elsewhere | reword to hosted only, link section 4 (AC10) |
