# U3 detail plan — program kinds: delivery and evergreen

Revision: r5, 2026-10-23 (r5 adds AC11, D10 and CP2b, the checkpoint commit order; r4 is unchanged otherwise). Owner approval: r4 2026-10-23; r5 2026-10-23. Charter: [README.md](../../README.md) (created by this unit).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: DevSpace has two program kinds. A delivery program (goal and completion condition) keeps today's structure, single-unit or master plan. An evergreen program owns a long-lived capability, has a `README.md` charter instead of a root `plan.md`, and runs initiatives (`U<n>`) that open and close independently, one at a time. `agent-workflow` is the first evergreen program, with its history as U1 and U2 and this unit as U3. Three small rule additions ride along: migration headers cite stable IDs, Main waits for CI with a foreground watch when told to, and a checkpoint is committed once, after its self-review passes.

| ID | Observable result |
| --- | --- |
| AC1 | `npm run docs:check` accepts the lifecycle `evergreen` in the `docs/README.md` Programs table, next to `active` and `closed`. For an `evergreen` row it requires the program to have `README.md` titled `# Charter — <program>` with the `##` sections `1. Capability and boundary`, `2. Owner decisions`, `3. Invariants`, `4. Initiatives`, `5. Opening an initiative` in that order, and no root `plan.md`; each Initiatives row starts with a unique `U<n>`, and every `implementation-plans/u<n>-<slug>/plan.md` in the program is titled `# U<n> detail plan — <title>` with the folder's `n` and is a row of that table. For an `active` or `closed` row the rules are unchanged. `npm run docs:check:test` keeps every existing test and adds one per case, all passing: (a) a valid evergreen program; (b) evergreen with a root `plan.md`; (c) evergreen without `README.md`; (d) charter with a wrong title; (e) charter with a section missing or out of order; (f) an Initiatives row without a `U<n>` ID; (g) a duplicate Initiatives ID; (h) an initiative plan missing from the table; (i) an initiative whose title number differs from its folder; (j) a root `README.md` in an `active` program and (k) in a `closed` program, both `file-role` violations. |
| AC2 | `program-docs` describes both kinds and limits the delivery-only rules to delivery: the File roles table has the charter row; the single-unit and master-plan sentences and the Plan shape bullets (`SKILL.md:26-32`) say they apply to delivery and add the charter branch (an evergreen program has no root `plan.md`; its initiative plans are rows of the charter's Initiatives table); "Lifecycle, index and ADRs" (`:59-63`) says the kind is the Lifecycle value (`active` or `closed` for delivery, `evergreen`), that only a delivery program closes and an evergreen program never does, that a decision that matters to one program stays in its master plan or charter, that an initiative belongs to exactly one program while one PR may carry work of several programs (a small part in another program is one milestone there citing the PR), and that an evergreen program has at most one open initiative with a plan at a time (several items may share one initiative or one small task). A charter template exists at `references/templates/charter.md` and is in the Resources table. The templates name the charter where they name the master plan or root `plan.md` (`templates/detail-plan.md` comment and header line, `templates/progress.md` header line, `templates/adr.md` comment). `references/migration.md` has a "Reshape: a program becomes evergreen" procedure. |
| AC3 | `docs/adr/0002-program-kinds.md` records D1 to D5 (context, decision, consequences, including why the folder stays flat: published migrations pin `docs/programs/security-hotfix/` paths and a kind can change, and that a delivery program which builds a capability may hand it to an evergreen program when it closes) and is listed in `docs/adr/README.md`. |
| AC4 | `docs/agent-loops.md` Sizing says medium work an evergreen program owns is planned as that program's initiative (a detail plan in its `implementation-plans/`), and "outside any program" applies only when no program owns the capability. `planning` step 1 (`SKILL.md:18`) reads the owning program's plan or charter, and "Planning a program" (`:40-42`) says a new delivery program starts as today and a new evergreen program starts with its charter and its first initiative plan, linking to `program-docs` for the shape. `CLAUDE.md` Code map and the `docs/README.md` Folders row for `programs/` mention the charter. |
| AC5 | `agent-workflow` is evergreen: the Programs row says `evergreen`; `README.md` is its charter (capability: the agent rules, skills, lifecycle loops, docs structure and checks, PR and CI conventions and the Codex process; boundary: product code, CI workflow jobs, and tooling-specific skill content that another program's unit adds with its tooling, as infrastructure master plan D9 says, stay with that program); the old root `plan.md` is at `implementation-plans/u1-working-rules/plan.md`, titled `# U1 detail plan — working rules, skills and docs system`, and `git diff -M` shows a rename whose only changed lines are the title, the header pointer line and relative links; the charter's Initiatives table lists U1, U2 and U3 with their plan links. |
| AC6 | `implementation-plans/u2-ci-result-db-push/plan.md` is the chat plan r3 of PR 13 in the detail-plan template, as a retroactive record. Its header says so: approved by the Owner in chat on 2026-10-23 after Codex plan gate PASS in round 3 (Main's session record), merged in PR 13 as `38d431b`. It keeps r3's goal, F1 to F11 under a "historical evidence" label, AC1 to AC8 including AC4a with the same IDs, the out-of-scope list, G1 to G4, the hypotheses, the commit list and the verification list; a template section r3 has no content for says "not recorded in r3". Nothing is added that r3 did not decide. |
| AC7 | The `agent-workflow` state records match the reshape in the same commit: `progress.md` header points to the charter; State names U3 as the current initiative, this plan's revision, the status and authority at that commit; the closing milestone's `(this commit)` becomes `7969be9`; new milestones, newest last: U2 merged (`PR 13, 38d431b`), then the reshape to evergreen (`this commit`); `problems.md` and `future-features.md` headers and "the program is closed" lines are replaced by current text. AW-002 moves from backlog `problems.md` to `agent-workflow/problems.md` Open, and FEAT-007 from backlog `future-features.md` to `agent-workflow/future-features.md`, each with its fields unchanged; the old `agent-workflow` lines that moved them out (`problems.md:16` AW-002, `future-features.md:12` FEAT-007) are removed so each ID appears once per file; the backlog keeps one `Moved to [agent-workflow](...)` line for each. `agent-workflow/future-features.md` gains two open entries with Status, Direction and Target program `agent-workflow`: FEAT-010 lists the evergreen candidates and the condition that opens each (Quality Engineering when `infrastructure` closes and hands over CI, the test suites and lint; Security Engineering when `security-hotfix` closes after H2-2, for RLS and grant review of new migrations and dependency audits; Design System when the foundation PR with shadcn, Zod and React Hook Form has merged, taking FEAT-005 and FEAT-006; Reliability and Operations when there are real users or hosted backup and restore is needed; Performance Engineering when production data exists to monitor), and says each charter states its boundary (D4) and does not invest in parts the techstack migration replaces (ADR 0001); FEAT-011 records skill rules and a way to verify that code is correct and performant (for example N+1 queries, unbounded queries, RLS policy patterns), Status deferred by the Owner on 2026-10-23, scope decided when it is planned. |
| AC8 | `supabase-migration` says a migration header cites stable IDs with their program (for example `security-hotfix H2-1a`, `infrastructure D9`, `ADR 0002`), never a doc path or section number, because a published migration is never edited and would pin that path; the three existing `security-hotfix` citations stay as they are. |
| AC9 | `docs/agent-loops.md` Loop 3 says that when the Owner says to wait for CI, Main keeps the turn open and watches until every check is terminal, instead of ending the turn to wait for app events. `git-pr-workflow` `references/pr-and-ci.md` Watch CI gives the command, `gh pr checks <n> --watch --interval 30` in the foreground, rerun if the shell timeout ends it first, and links to Loop 3; its "Create or update a PR" step 6 names this case next to the app's PR tools. |
| AC10 | Exclusions hold: no file under `supabase/`, `docs/programs/infrastructure/`, `docs/programs/security-hotfix/` or `.github/` changes; the `docs:check` allowlist is unchanged; backlog FEAT-005 and FEAT-006 stay in the backlog; `npm run lint` still reports 81 problems. |
| AC11 | `docs/agent-loops.md` Self-review says the checkpoint order is finish, self-review, fix and review again until no `Critical` or `Required`, then commit when granted, and that a correction commit answers a finding of a review after the commit (Main, Codex, Owner QA), never the author's pre-commit pass (the author's own pass over the whole diff after the checkpoints are committed counts as a later review). `git-pr-workflow` `SKILL.md` (Commit) requires a passed self-review before the commit, one commit per checkpoint (split only for a reason stated in the report; a small task without checkpoints as `agent-loops.md` Sizing allows), and a commit sent only after every edit succeeded, never in parallel with an edit; `references/branch-and-commit.md` (Commit procedure step 6, Corrections and history) says the same and links to `agent-loops.md`. `code-review` Re-review asks for a new correction commit only when the reviewed candidate was committed. |

### 1.2 Scope and non-goals

- In scope: AC1 to AC11.
- Non-goals: converting `infrastructure` or `security-hotfix`; any other program becoming evergreen (the candidates are only recorded, as FEAT-010); a separate "kind" column; moving any program folder; several open initiatives per evergreen program (D5); new State fields; work on AW-002 or FEAT-007 beyond moving them; performance rules in skills (only recorded, as FEAT-011); the U3 work of `infrastructure`.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Delivery behavior in `docs:check` does not change: every existing test stays and passes, AC1 (j) and (k) pin the delivery file roles, and the run on the current repo before the reshape reports 0 violations. | The blocking `docs` CI job turns red on `main`, or an existing program loses a check. |
| G2. The U1 move follows `program-docs` `references/migration.md`: baseline commit recorded, the old Spec unchanged, meaning checked against `git show <baseline>:docs/programs/agent-workflow/plan.md`. | An approved decision, gate or acceptance item of the original program is lost or reworded. |
| G3. No published migration and no path a published migration cites changes. | A dead citation in an immutable file. |
| G4. Each rule has one owner: shape in `program-docs`, sizing, timing and waiting in `agent-loops.md`, commands in the skills, the decision record in ADR 0002; others link. | Two copies drift. |
| G5. Skills stay near 150 lines; long procedure goes to a reference. | Skills grow past what an agent reads in full. |
| G6. Every commit on the branch passes `npm run docs:check`, and State changes in the commit that changes what it describes. | A commit where State or a record lies about the files beside it. |

### 1.4 Owner decisions that bind this unit

All 2026-10-23.

- D1. Two program kinds: delivery (a goal and a completion condition) and evergreen (owns a capability that must be maintained; its initiatives open and close independently).
- D2. Program folders stay flat (`docs/programs/<name>`); the kind is the Lifecycle value in `docs/README.md`: `active` or `closed` for delivery, `evergreen`. No separate kind column.
- D3. An evergreen program's identity document is a `README.md` charter, not a master plan; it has no root `plan.md`; each initiative has a detail plan at `implementation-plans/u<n>-<slug>/plan.md`. Delivery programs keep their current structure: a single-unit root detail plan, or a master plan with unit plans.
- D4. An initiative belongs to exactly one program. A PR may carry work of several programs; a small part in another program is one milestone there citing the PR.
- D5. An evergreen program has at most one open initiative with a plan at a time. Several items may share one initiative, or one small task with no plan.
- D6. `agent-workflow` becomes evergreen; its original plan is U1; PR 13's chat plan r3 is committed as U2; this plan is U3.
- D7. A migration header cites stable IDs, not doc paths.
- D8. When told to wait for CI, Main watches it in the foreground with `gh pr checks <n> --watch --interval 30`.
- D9. The evergreen candidates (Quality Engineering, Security Engineering, Design System, Reliability and Operations, Performance Engineering) are recorded with their opening conditions, not opened. Performance skills are a deferred future feature of `agent-workflow`.
- D10. A checkpoint is committed once, after its self-review passes; fixes from the author's own pass go into that commit, and correction commits are only for findings of a later review. One commit per checkpoint unless there is a stated need. (Owner, after the U3 CP1 and CP2 history; Sonnet's five commits were squashed into one per checkpoint at the Owner's request, and Main's review correction stays a separate commit.)

## 2. Repository facts

Baseline: `38d431b` (PR 13 merge), checked 2026-10-23.

- `scripts/docs/check-structure.mjs:55` `LIFECYCLES = new Set(["active", "closed"])`; `:641` rejects any other value — justifies AC1.
- `check-structure.mjs` `roleOf` accepts only `plan.md`, `progress.md`, `problems.md`, `future-features.md` and `implementation-plans/*/plan.md` in a program; anything else is `file-role` — a charter `README.md` needs a new role, only for `evergreen` (AC1 (j), (k)).
- `checkPlanShape` matches unit detail plans against the master plan's `4. Units` rows; a root `plan.md` plus `implementation-plans/` requires a master plan title — the evergreen branch matches against the charter instead (AC1).
- `check-structure.mjs` milestone check allows at most one `(this commit)` and only as the last line (`:293-297`); IDs must be unique per `problems.md` and a FEAT may be marked moved only once across the repo (`:324-330`, `:600-607`) — justifies AC7.
- `agent-workflow/progress.md:39` ends with "Program closed ... (this commit)", which `git log` shows is `7969be9`; `problems.md:3,7` and `future-features.md:3` say the program is closed; `problems.md:16` and `future-features.md:12` hold the AW-002 and FEAT-007 moved-out lines — justifies AC7.
- `program-docs` `SKILL.md:26-32` (single-unit and master-plan shape), `:59-63` (lifecycle `active` or `closed`, closing, decisions in the master plan); `planning` `SKILL.md:18`, `:40-42`; `templates/detail-plan.md:1,5`, `templates/progress.md:5`, `templates/adr.md:1` all assume a master plan or a root `plan.md` — justifies AC2 and AC4.
- The `docs:check` allowlist holds three `security-hotfix` files because migrations `20261021131351`, `20261021181051` and `20261021185249` cite `docs/programs/security-hotfix/plan.md` and `plan-h2.md` — justifies D2, AC8 and G3.
- `docs/programs/agent-workflow/plan.md` is a single-unit root detail plan, 281 lines, titled "Agent workflow detail plan — working rules, skills and docs system"; no other repo file links to it — the U1 move breaks no outside link (AC5).
- `docs/agent-loops.md:28`: medium work outside any program has no plan file; the PR and the entry's Done line are the record — the gap this unit closes for work an evergreen program owns (AC4).
- `.claude/rules.md` section 2: Main edits state records (`progress.md`, `problems.md`, `future-features.md`, backlog entries) directly — justifies giving AC7 to Main.
- `docs/agent-loops.md` owns timing and stop rules (its header); `pr-and-ci.md:27` (step 6) points to the app's PR tools after a PR exists — justifies AC9.
- The highest FEAT ID in `docs/` is FEAT-009 — justifies FEAT-010 and FEAT-011 (AC7).
- `program-docs` `SKILL.md` 92 lines, `planning` 63, `agent-loops.md` 76 — room within G5.

## 3. Bounded implementation hypotheses

- A `charter` role in `roleOf` keyed on the program's Lifecycle from `docs/README.md`, parsed before the program loop; may change if AC1 holds.
- `PLAN_SECTIONS.charter` and a `CHARTER_TITLE` regex next to the master ones; the Initiatives table reuses the Units-row parsing; may change if AC1 holds.
- The cross-program and one-at-a-time rules sit in `program-docs` "Lifecycle, index and ADRs"; if the skill would pass about 150 lines, the evergreen detail moves to `references/evergreen.md` (G5).
- U1 slug `u1-working-rules`; may change if the folder matches `u<n>-<slug>`.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 (Sonnet) | `docs:check` evergreen support with the AC1 tests; charter template and the other template lines; `program-docs` and `migration.md`; ADR 0002 and its index row; `agent-loops.md` Sizing, `planning`, `CLAUDE.md`, `docs/README.md` Folders text (AC1 to AC4). | `npm run docs:check` 0 violations on the unchanged programs; `npm run docs:check:test` all pass, existing and new; `npm run lint` 81; `npx tsc --noEmit` exit 0; `git diff --check`. |
| CP2 (Sonnet) | AC8 and AC9. | `npm run docs:check`; `git diff --check`. |
| CP2b (Main) | AC11 (`agent-loops.md`, `git-pr-workflow`, `code-review` Re-review), one commit, written by Main at the Owner's request. | `npm run docs:check`; `git diff --check`; a search for other commit-cadence rules (`agent-loops.md` Sizing, `rules.md` section 2, `planning` brief) finds no conflict. |
| CP3 (Main) | The `agent-workflow` reshape in one commit: charter with U1 to U3, U1 move, U2 and U3 plan files, Programs row `evergreen`, state records, the AW-002 and FEAT-007 moves and the FEAT-010 and FEAT-011 entries (AC5 to AC7). | `npm run docs:check` 0 and `docs:check:test` pass; `git diff -M --stat` shows the U1 rename and `git diff -M` on it shows only the allowed lines; the migration meaning checklist (`migration.md` steps 2 and 8) in the report; `grep` finds each of AW-002 and FEAT-007 once per file. |

Codex gates: this plan, and the diff CP1 to CP3 before push, including the fidelity of U2 to r3 (`docs:check` runs in the blocking `docs` job). The CP3 commit, push, PR and merge are separate Owner grants.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A `docs:check` change rejects a valid delivery program or passes an invalid one. | G1; AC1 tests (a) to (k); the existing suite stays green. |
| Evergreen programs become a catch-all. | The charter's boundary section; D4 and D5; each initiative still has its own plan, acceptance and close. |
| The U1 move loses meaning. | G2 and the migration meaning check. |
| The U2 retroactive record adds decisions r3 did not make. | AC6; Codex compares it with r3. |
| CP1 and CP2 land rules for evergreen before any evergreen program exists. | Intermediate commits on one branch; each passes `docs:check` (G6); CP3 completes the outcome before push. |

- Rollout runbook: none (docs and the docs checker only; no hosted step).
- Stop when: a meaning item of U1 cannot survive the move; `docs:check` needs a delivery rule change; a published migration would need a change.
- Rollback: fix forward first (`program-docs` `references/migration.md`, Rollback). If a revert is needed, revert the checker and the docs structure together, then in the same change set the `agent-workflow` State and milestones to the current truth: keep the U2 merge milestone and the U2 evidence, and add a milestone that U3 was reverted; never restore the old State block as if current. If another initiative has started on the evergreen shape, reconcile with the Owner before reverting. No hosted state.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
