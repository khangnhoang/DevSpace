# AW-U13 detail plan — Skills hold no rollout state

Revision: r1, 2026-11-04. Owner approval: 2026-11-04 (plan, rule text, own branch from `main`, implementation; later the same day a Codex diff gate, then the plan commit, the implementation commit, push, PR and merge on green CI). Master plan or charter: [README.md](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the project skills hold rules, procedures, pitfalls and pointers to stable example files, worded so they stay true as units land, and no rollout or progress state. `skill-authoring` says so, and the two invariants that today make every unit edit skills ("a skill states only what DevSpace has today", "a skill line states only what exists on `main` after the unit merges") are reworded to match. A pure UI unit no longer edits a skill only to keep a progress sentence true.

| ID | Observable result |
| --- | --- |
| AC1 | An agent reading `skill-authoring`, What a skill holds, finds that a skill holds no rollout or progress state (which units, forms or rows are done, unit or PR history, the next free identifier), where that state goes, and that a unit edits a skill only when it changes a rule, procedure, pitfall or path the skill names; the deferred-tooling rule stays. |
| AC2 | The agent-workflow charter invariant and the app-foundation master plan invariant point to that rule instead of "states only what exists". |
| AC3 | Every line S1–S14 of section 2.1 is reworded or removed as that table says, and every kept line of section 2.2 is unchanged. |
| AC4 | `rg` for each removed phrase of section 4, CP1, finds no hit under `.claude/`, `AGENTS.md`, `CLAUDE.md` and the two edited plans; `npm run docs:check` reports 0 violations. |

### 1.2 Scope and non-goals

- In scope: the lines of section 2.1; `skill-authoring` (`SKILL.md`, What a skill holds, and `references/audit.md`); the invariant lines of `docs/programs/agent-workflow/README.md` section 3 and `docs/programs/app-foundation/plan.md` section 3; this plan's Initiatives row; State in `progress.md`.
- Non-goals: any rule change beyond the wording of section 2.1; `AGENTS.md` (its code map lists shadcn primitives and form groups, the same pattern: reported as a follow-up); completed detail plans, which are historical; the AF-U6 plan, which its own author adjusts (section 5); any test, code or checker change.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. A rewording keeps every rule, pitfall and boundary the old line carried (seed users untouched, reserved selectors, no 5xx answers, no AI call, the payment hand validation, the `npm` install-script pitfall). | A cleanup silently drops a rule and an agent breaks a test or a flow. |
| G2. A reworded line is true on `main` both before and after AF-U6 merges. | The skill becomes false the moment one of the two lands, and the next unit edits it again. |
| G3. State removed from a skill already exists in its owner (QE-U4 plan and progress for the C2 mapping, QE-F8 for the remaining e2e audit, DM-U5 plan and PR 52 for the Node 26 evidence, the spec files for row lists), or is deleted as stale. | Evidence lost instead of moved. |
| G4. No edit through `.agents/skills/`; the symlinks stay unchanged. | Two copies drift. |

### 1.4 Owner decisions that bind this unit

- (2026-11-04, Owner, via the AF-U6 planning session) Skills that hold progress snapshots are a design flaw; AF-U6 removes only the sentences it makes false, and the repository-wide cleanup and the rule change are this initiative.
- (2026-11-04) The Owner approved the rule text of section 2.3 (`AGENTS.md` section 8) and an own branch from `main` that lands before AF-U6 CP3 (section 5).

## 2. Repository facts

Baseline: `78c80ba`, checked 2026-11-04. Method: `rg` over every `.claude/skills/**/*.md` except the vendored `playwright-cli` for unit and problem IDs and for rollout words (`yet`, `until`, `still`, `currently`, `so far`, `first`, `later unit`, `today`); `SKILL.md` of `test-quality-strategy`, `frontend-design`, `server-actions`, `skill-authoring`, `planning`, `program-docs` and `frontend-workflow/references/async-state-and-forms.md` read in full. The other files were checked by search only.

### 2.1 Lines to change

| # | Location | Class | Proposal |
| --- | --- | --- | --- |
| S1 | `frontend-design/SKILL.md:16` | state | Drop the primitive list (readable from `components/ui/`) and the form-by-form list ending "only the admin user forms still use controlled state until the last unit … converts them". New text: "shadcn primitives sit in `components/ui/` (`components.json`) on `radix-ui` and `class-variance-authority`. A new or reworked form uses React Hook Form with `zod` through `@hookform/resolvers` (link to `frontend-workflow`, as today); a form still on controlled state is converted only by a task that owns it. The auth forms share their controls in `app/components/AuthFields.tsx`." The package sentence stays. |
| S2 | `frontend-design/SKILL.md:69` | rule with state | "no `window.confirm` remains in `app`, so do not add one" becomes "never add a `window.confirm`". |
| S3 | `frontend-workflow/references/async-state-and-forms.md:3` | state | Same rewording as S1: drop the list of converted forms and the "only the admin user forms still use controlled state …" clause; keep "a form that posts to a server action also keeps the action's own validation (`server-actions`)". |
| S4 | same file `:32` | unit history | "(`server-actions` and the AF-U4 plan, G2 and G3)" becomes "(`server-actions`, Return contract)"; the rule itself stays in the line. |
| S5 | same file `:34` | inventory, and conflicts with the E2E rule | Replace the `learner-forms.spec.ts` row list with: tests are selected by `test-quality-strategy` (E2E rule, Component tests): a successful e2e row and one per integration boundary, client-only logic in a component test; `learner-forms.spec.ts` shows the Storage boundary (`page.route` fakes the avatar upload on the failure and wiring paths; one row uploads for real and removes its own object). |
| S6 | `server-actions/SKILL.md:14` | pitfall + state | Keep the pitfall: "`app/action/payment.ts` (payment and coupon actions) validates by hand; its rewrite belongs to security-hotfix H2-2b, so another task does not convert it." Replace "React Hook Form exists for the learner forms … first exists with the later units of the app-foundation program …, which extends this skill" with "A form's schema also lives in `lib/schemas/`. A form that writes through the browser Supabase client relies on RLS for enforcement; a form that posts to a server action never replaces the action's own parse (Validate on the server)." The last sentence (no other validation or form library) stays. |
| S7 | `test-quality-strategy/SKILL.md:20` | growing inventory | Replace the list of schema test files with the rule and one example: a schema gets unit tests in the `__tests__/unit/` file of its schema file (for example `action-schemas.test.ts`); a submit helper that takes its call as a parameter is unit-tested with the call faked (`auth-outcomes.test.ts`). The action-parse and endpoint-row rule stays. |
| S8 | same file `:22` | program state | Drop "including app-foundation's shared-schema unit tests and a successful e2e row per form plus one for each integration boundary it has (E2E rule below)": the minima live in the app-foundation master plan, and both are already stated as rules (S7, E2E rule). |
| S9 | same file `:40` | inventory (repeats the spec rows and headers) | Replace with three bullets that keep every rule (G1): the rows of a spec, named by matrix ID, and its test-plan header where it has one are the inventory, read them before adding a row, select by the contract, no RLS guarantee repeated in a browser; a row never changes a seed user's account (it reserves what it creates with the `reserve*` helpers or uses a fixture such as `createUserFixture`, an edit row reserves the edited value) and changes a seed user's profile fields only through a scoped acquire and restore, a client-validation refusal row asserts that no mutation request was sent while a server, database or Auth refusal row sends the request and asserts the refusal and unchanged data, a failed save is an aborted `page.route` request, never a 5xx answer, and because the local stacks send no mail an Auth request that would mail is answered or held with `page.route`; no row reaches Google: an AI action is called only with input it refuses before the provider call (`[V7]`), and the AI buttons' decisions are unit-tested with the save passed in (`ai-exercises.test.ts`). |
| S10 | same file `:51` | unit history | "The first file is `CourseFormDialog.test.tsx` (QE-U4)." becomes "`CourseFormDialog.test.tsx` shows the pattern." |
| S11 | same file `:58` | state | Delete "Moved so far … C2 … Every other row stays until the audit of quality-engineering QE-F8 classifies it." (in the QE-U4 plan, QE progress and QE-F8); "the mapping is recorded" becomes "the mapping is recorded in the plan or progress of the unit that moves the row". |
| S12 | same file `:63` | state in a pitfall | "`WORKER_URLS` currently maps the course, transactions, users and lessons page workers" becomes "`WORKER_URLS` (`__tests__/helpers/server-action-core.ts`) maps only some page workers". |
| S13 | `dependency-updates/SKILL.md:88` | unit evidence in a pitfall | Drop "at DM-U5" and "every DM-U5 check passed" (DM-U5 plan, PR 52); keep the pitfall: npm 11.20 skips the install scripts `allowScripts` does not cover, the root `postinstall` still runs, the `unrs-resolver` script can install a missing binding, so approve or deny no script without a plan. |
| S14 | `program-docs/SKILL.md:57` | stale state | Delete "next new units are AW-U11, AF-U7 and DM-U2, while AF-U2 is already planned" (AW-U12 exists; the allocation rule above gives the next number). The migration fact before it stays. |

### 2.2 Lines kept

- Known-defect pitfalls with a problem ID: `frontend-design/references/learning-experience.md:9` (P20), `supabase-migration/references/rls-and-storage.md:23` (P10), `server-actions` P16 and P25, `test-quality-strategy` BL-F7. They change what an agent does, and the fix removes them (section 2.3).
- Example and design pointers to stable files: `async-state-and-forms.md:24` (the learner forms show the pattern), `test-quality-strategy/SKILL.md:101` (QE-U3 plan as the test-stack design), `supabase-migration/SKILL.md:43` (H2-1 B as an example).
- `dependency-updates/SKILL.md:94`: a row with its own removal condition.
- `program-docs/references/templates/*`: placeholders, not state.

### 2.3 Proposed rule text

`skill-authoring/SKILL.md`, What a skill holds, second paragraph, replaced:

> A skill holds rules, procedures, pitfalls and pointers to stable example files, worded so they stay true as work lands. It holds no rollout or progress state: which units, forms, screens or test rows are done or still pending, unit or PR history, or the next free identifier. That state lives in the owning program's docs, and a test inventory lives in the test files (Choosing where an instruction goes). A unit edits a skill only when it changes a rule, a procedure, a pitfall or a path the skill names. A pitfall about a known defect names its problem ID, and the change that fixes the defect removes it. A skill gives no steps for tooling or code that is not on `main`: tooling that does not exist yet is named once as deferred, with no steps, and the steps arrive in the PR that adds the tooling.

`skill-authoring/references/audit.md`, Procedure step 2, "belongs elsewhere" gains: "rollout or progress state in a skill belongs to the program's docs or the test files".

`docs/programs/agent-workflow/README.md` section 3, second invariant:

> A skill holds no rollout or progress state and gives no steps for what is not on `main` (`skill-authoring`, What a skill holds), and no skill widens a permission (`AGENTS.md` section 8) — prevents agents running tools that do not exist, editing skills on every unit, or reading a skill as a grant.

`docs/programs/app-foundation/plan.md` section 3, last invariant:

> A skill line stays true after the unit merges and records no unit progress; a unit edits a skill only for a rule, procedure, pitfall or path it changes (`skill-authoring`, What a skill holds) — prevents agents following instructions for code that is not there, and skill edits made only to keep progress current.

## 3. Bounded implementation hypotheses

- The exact sentences of S1–S14 may be tightened while writing if G1 and G2 still hold; the class and the kept rules may not change.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | S1–S14, the rule text of section 2.3, the two invariants, State. | `fnm exec -- npm.cmd run docs:check` (0 violations); `rg` across `AGENTS.md`, `CLAUDE.md`, `.claude/`, `docs/programs/agent-workflow/README.md` and `docs/programs/app-foundation/plan.md` for "still use controlled state", "first exists with the later units", "Moved so far", "The first file is", "next new units are", "at DM-U5", "currently maps", "AF-U4 plan, G2", "states only what DevSpace has today", "states only what exists on" (no hit); read the edited files through `.agents/skills/` and compare; `Tự review` against G1 and G2. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| AF-U6 (branch `feat/af-admin-user-forms`, AC10) edits the same lines of S1, S3, S6 and S7–S11. | AW-U13 lands first on its own branch from `main`; AF-U6 then drops the AC10 skill edits this unit makes unnecessary and keeps only a rule it introduces (for example how a form derives its schema from the action's). The AF-U6 planning session decides that change to its plan. |
| A rewording loses a rule (G1). | CP1 review compares each old and new line pair against G1. |
| The same pattern stays in `AGENTS.md` (code map). | Reported as a follow-up for the Owner; out of scope here. |

- Rollout runbook: none (docs only).
- Stop when: a line cannot be reworded without losing a rule; the AF-U6 implementor is editing the same files at that moment.
- Rollback: revert the commit; nothing else depends on it.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
