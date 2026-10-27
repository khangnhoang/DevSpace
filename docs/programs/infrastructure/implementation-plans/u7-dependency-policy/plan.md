# U7 detail plan — Dependency policy

Revision: r4, 2026-10-27 (r2 answers Codex plan round 1: an open entry for the hosted answer check, the Monaco CDN version stays pinned, FEAT-014 fields after the move, the AC6 QA matrix; r3 answers round 2: BL-010 is created in CP1, before INF-002 is resolved; r4 adds the dependency check of Owner decision D7). Owner approval: r4 2026-10-27, after Codex plan gate PASS in round 4. Master plan or charter: [master plan](../../plan.md) (Units row U7, [FEAT-001](../../future-features.md)).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: a new project skill, `dependency-updates`, states how DevSpace adds, updates and removes dependencies: one procedure per update type (patch, minor, major, security fix), the checks each needs taken from the test suite, and a table of dependency rows for the special cases. `test-quality-strategy` gains a row for dependency changes. The seeded quizzes accept their correct answers (INF-002, batched). The program's open entries have a home outside infrastructure, so it can close after this PR merges.

| ID | Observable result |
| --- | --- |
| AC1 | `.claude/skills/dependency-updates/SKILL.md` exists, passes `npm run docs:check`, and its `description` and Use when name: adding, removing or updating a package in `package.json` or `package-lock.json`, acting on `npm outdated` or `npm audit`, changing the Node version, and updating the Supabase CLI, Playwright or the Monaco version loaded from the CDN. |
| AC2 | The skill gives one procedure per update type: patch (update and run the checks), minor (read the changelog first, then the checks), major (its own task, sized by `docs/agent-loops.md` Sizing, never inside another change), security fix (early, ordered by impact: a production runtime path first, `npm audit --omit=dev` before dev-only findings; never `npm audit fix --force`). Each procedure says which checks run by linking `test-quality-strategy` (Which command for which change), not by restating them. |
| AC3 | `test-quality-strategy` (Which command for which change) has a row for a dependency change (`package.json`, `package-lock.json`) that runs the static checks, `npm run build`, `npm test` and `npm run test:e2e` on the local stack; the skill links to it. The Dependency item of `code-review/references/special-cases.md` points to `dependency-updates` instead of "planned as infrastructure U7 (FEAT-001)", and no file under `.claude/` or `CLAUDE.md` still calls the policy planned. |
| AC4 | The skill has a table of dependency rows. It holds a row for each special case found in discovery (section 2): Node, the Supabase CLI, `@playwright/test`, `next` with `eslint-config-next`, the Supabase auth helper `@supabase/ssr`, and Monaco (the npm package and the CDN version). It states that a PR adding a dependency adds its own row (D1); a package already in `package.json` with no special case has no row. It holds no list of current versions, outdated packages or open findings (those are state). |
| AC5 | The Node row says production (Vercel), CI (`actions/setup-node`) and `@types/node` use one Node major, names where each is set, and points to FEAT-019 for the move to Node 26. The Supabase CLI row says an update is accepted only when `npx supabase db reset`, the local catalog compared with the hosted catalog (Main-only, `.claude/rules.md` section 4) and the full suite stay green. The Monaco row says `npm audit` cannot see the CDN version, names where it is set, says the CDN version stays pinned to an exact version (never a range or `latest`), and says a change of it, or any `@monaco-editor/*` update that changes it, is reviewed against the Monaco advisories like a dependency update. |
| AC6 | INF-002: after `npx supabase db reset`, every row of the QA matrix in Appendix A gives its expected result, and `npm test` and `npm run test:e2e` pass. |
| AC7 | Records in this PR: INF-002 Resolved, its line naming backlog BL-010; BL-010 (the hosted `exercises` rows may hold uppercase answers too; a read-only count on hosted needs the Owner's approval) as an open entry; FEAT-014 `Moved to` the backlog with its ID and its Direction unchanged, its Status, Target program and start condition rewritten for the backlog (no infrastructure master-plan revision after the program closes); backlog FEAT-019 (Node 26 for production, CI and `@types/node`, Codex-gated), FEAT-020 (major updates waiting) and BL-009 (security findings with no in-range fix) carry the live follow-ups of FEAT-001, each package in one entry only (`nodemailer` 10 in BL-009, as a security fix); FEAT-001 stays open with Status "delivered in U7, awaiting merge"; infrastructure State names this plan. |
| AC8 | A fresh read-only session asked to plan "update `nodemailer` to 10" loads `dependency-updates`; a fresh read-only session asked to plan "fix the quiz completion screen (BL-004)" does not. |
| AC10 | The skill has a "Dependency check" procedure (D7): Main runs it when a delivery program opens or closes and whenever the Owner asks. It runs `npm outdated` and `npm audit` (and `npm audit --omit=dev`), reviews every row of the dependency rows table, the exact pins included (Supabase CLI, `@playwright/test`, the Monaco CDN version, the Node major), and changes no file except records: patch updates become one small task, and each minor, major or security update not yet tracked becomes or updates a backlog entry. It installs nothing; an update needs the Owner's request (`.claude/rules.md` section 4). `program-docs` (Lifecycle, index and ADRs) names the check as a step of opening and of closing a delivery program, as a pointer to the skill. |
| AC9 | On this PR, which changes `supabase/seed.sql`, all six CI jobs run and pass. `npm run docs:check` and `npm run docs:check:test` pass locally. |

### 1.2 Scope and non-goals

- In scope: the new skill; one row in `test-quality-strategy`; the pointer in `code-review/references/special-cases.md`; the dependency-check pointer in `program-docs`; the three seed rows of INF-002; the records in AC7.
- Non-goals:
  - updating, adding or removing any dependency, `npm audit fix` included (the waiting majors go to FEAT-020, the findings to BL-009);
  - the Node 26 move, an `engines` field, `.nvmrc`, `ci.yml` or Vercel settings (FEAT-019);
  - Dependabot, Renovate, a scheduled CI job or any automated update bot (D7);
  - checking whether hosted exercise rows mix cases (a separate read-only check, not this unit);
  - `@supabase/ssr` and other auth helpers (ADR 0001);
  - FEAT-014, BL-008 and the other backlog entries.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The skill links each rule it does not own (checks: `test-quality-strategy`; sizing of a major: `docs/agent-loops.md` Sizing; hosted catalog access and git grants: `.claude/rules.md` section 4) by file and section name. | Two owners for one rule drift apart, and the AW-006 and AW-007 audits find it again. |
| G2. The skill states only tooling on `main` (`skill-authoring`, What a skill holds); Node 26, an update bot and an `engines` field are not steps. | Agents follow steps for tools that do not exist. |
| G3. No version numbers that change with each update (outdated list, audit counts) in the skill; a version appears only where a row names where it is set. | The skill goes stale on the next update and tells agents a wrong current state. |
| G4. The seed change touches only `correct_answer` of exercises 1 to 3 (`A`, `B`, `C` to `a`, `b`, `c`). | Other seed changes break the RLS counts and the e2e rows that read seed rows. |
| G5. Nothing reaches hosted; the catalog comparison in the Supabase CLI row is a rule for later updates, not a step of this unit. | A docs unit writes to or reads from production. |

### 1.4 Owner decisions that bind this unit

- Master plan decisions 5 and 9: U7 is last, and the skill ships with the tooling it describes (none new here).
- D1 (2026-10-27) Keep the ADR 0003 order: U7 first, then `app-foundation`. The policy is written per update type and special case, not as a fixed package list, and a PR adding a dependency adds its own row; Zod, React Hook Form and shadcn get their rows in the `app-foundation` unit that adds them.
- D2 (2026-10-27) The policy is a new skill, `dependency-updates` (`.claude/rules.md` section 8).
- D3 (2026-10-27) The Node 26 move stays out of U7: a backlog entry, its own Codex-gated task after the program closes. U7 states the one-major rule only.
- D4 (2026-10-27) INF-002 is batched into this PR as its own checkpoint and commit.
- D5 (2026-10-27) FEAT-014 moves to `docs/backlog/` with its ID.
- D6 (2026-10-27) The `/placeholder.jpg` 404 in the `e2e` log is unrelated to U7 and is recorded as backlog BL-008 with the PR 28 docs catch-up.
- D7 (2026-10-27) Dependencies are checked by hand at fixed points: when a delivery program opens or closes, and whenever the Owner asks (for example monthly). The check covers every package and every exact pin; pins are not frozen, they change only through a deliberate update. No bot and no scheduled CI job.
- With D4 the PR is no longer docs-only; it still gets no Codex gate (master plan section 4: no CI, migration, permission or server-action change).

## 2. Repository facts

Baseline: `7ad7a92`, checked 2026-10-27.

- Node: CI sets `node-version: 24` in every job of `.github/workflows/ci.yml`; Vercel production runs `22.x` (FEAT-001); `@types/node` is `^22.20.5`; no `engines` or `.nvmrc`. Node 26 enters LTS on 2026-10-28 (`nodejs/Release` `schedule.json`) — justifies AC5 and D3.
- `supabase` is pinned exactly at `2.121.0` (2.122.0 exists); `@playwright/test` exactly at `1.64.1`, and CI installs the browser with `npx playwright install --only-shell chromium` — justifies the AC4 rows.
- `next` and `eslint-config-next` are both `^16.4.3` and moved together in INF-001 (PR 16) — justifies the AC4 row.
- `@monaco-editor/loader` 1.7.0 loads `monaco-editor@0.55.1` from `cdn.jsdelivr.net` by default (`node_modules/@monaco-editor/loader/lib/es/config/index.js:3`); the app sets no `loader.config` (`app/(main)/try_it/page.tsx` imports `@monaco-editor/react` only). The npm `monaco-editor` 0.57.0 pins `dompurify` exactly at 3.4.15 — justifies the Monaco row and BL-009.
- `npm audit` (2026-10-27): 5 findings, 1 critical (`dompurify` through `monaco-editor`), 1 high (`nodemailer` 7.0.13, fixed only in 10.2.1), 2 moderate (`@tailwindcss/typography`, `postcss-selector-parser`, only a downgrade offered), 1 low (`monaco-editor`) — justifies BL-009 and the security-fix procedure.
- `npm outdated` (2026-10-27) majors waiting: `typescript` 5 to 7, `eslint` 9 to 10, `lucide-react` 0.554 to 1, `@google/genai` 1 to 2, `nodemailer` 7 to 10, `@types/nodemailer` 7 to 8, `@types/node` 22 to 26; `@supabase/ssr` 0.7 to 0.12 waits for the migration — justifies FEAT-020.
- FEAT-001 asks to update patches "regularly", and nothing in `.claude/`, `CLAUDE.md` or `.github/` triggers a dependency check (no `dependabot.yml`, no scheduled workflow); `program-docs` (Lifecycle, index and ADRs) lists the steps of closing a delivery program — justifies AC10 and D7.
- `test-quality-strategy` (Which command for which change) has no row for `package.json` or `package-lock.json`; `code-review/references/special-cases.md:8` says the version policy "is planned as infrastructure U7 (FEAT-001)", the only such line in `.claude/` and `CLAUDE.md` — justifies AC3.
- `supabase/seed.sql:89-92` stores `correct_answer` `A`, `B`, `C`; `app/components/Quiz.tsx:83` compares the selected option exactly; the RLS tests count exercise rows and read no `correct_answer` (`__tests__/rls/content.test.ts:59-75`) — justifies AC6 and G4.
- `app/admin/courses/coursesclient.tsx:198` falls back to `/placeholder.jpg`, which `public/` does not have; the seed sets no `image_url`; the `e2e` web server logged `internal image response failed for /placeholder.jpg 404` in runs 40374119999, 40379238483 and 40383406684 — justifies D6.

## 3. Bounded implementation hypotheses

- `.claude/skills/dependency-updates/SKILL.md` from the `skill-authoring` template, with sections Use when, Workflow (the four update types and adding or removing a package), Dependency rows, Stop when, Checklist, and no `references/` — may change (a reference for the rows table if `SKILL.md` grows past about 200 lines) if AC1 to AC5 and G1 to G3 hold.
- The `test-quality-strategy` row reads "Dependency (`package.json`, `package-lock.json`)" with "static checks, `npm run build`, `npm test`, `npm run test:e2e`" and "Stack, Chromium" — may change in wording if AC3 holds.
- INF-002 is three character edits in `supabase/seed.sql:90-92` — no other way is expected.
- AC8 runs as two short read-only Sonnet sessions started by Main, as the agent-workflow U5 AC8 cases did — may change to another fresh-session check if it shows which skills loaded.

## 4. Checkpoints

The PR 28 docs catch-up and BL-008 ship with the plan commit (Main, state records). INF-002 runs first because it is the easiest to verify (`planning`, batch order).

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | INF-002: seed answers lowercase; backlog BL-010 created first, then the INF-002 Resolved line in `problems.md` naming BL-010, with `(this commit)`, all in one commit. | `npx supabase db reset`; `npm test`; `npm run test:e2e`; the Appendix A matrix on `npm run dev` (AC6). |
| CP2 | The `dependency-updates` skill, the `test-quality-strategy` row, the `special-cases.md` pointer and the `program-docs` pointer (AC1 to AC5, AC10). | `npm run docs:check`; `npm run docs:check:test`; Main reads every link target; `git diff --stat` shows only `.md` files. |
| CP3 | Records (AC7): FEAT-014 moved, FEAT-019, FEAT-020 and BL-009 added, FEAT-001 Status, State. | `npm run docs:check`; every FEAT-001 follow-up in section 2 has an open entry, and BL-010 from CP1 is still open. |
| CP4 | AC8 trigger check, run by Main after the CP3 review. | Two read-only sessions; their transcripts show which skills loaded. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The skill restates rules owned elsewhere and drifts. | G1; Main's review greps for restated commands and permission lines. |
| The dependency check is never run because nobody loads the skill at a program boundary. | AC10 puts the pointer in `program-docs`, which every program open and close already loads; the first check runs at the infrastructure close. |
| The description does not trigger on a dependency task, so the skill is never read. | AC8 runs a yes and a no case before the PR. |
| Hosted exercise rows also hold uppercase answers, so the bug also exists on production. | Out of scope; backlog BL-010 (AC7) tracks the read-only check, which Main runs only with the Owner's approval. |
| The seed change breaks a test that reads answers. | Facts say none does; CP1 runs `npm test` and `npm run test:e2e`. |

- Rollout runbook: none before merge. After merge, in the docs catch-up of the next task: FEAT-001 closes as `Done` with the PR, the U7 milestone records the merge, then the program closes (master plan section 5, step 6): the first dependency check (AC10), State completed, problems resolved or moved, backlog reviewed with the Owner, Programs row `closed`.
- Stop when: a special-case row needs a rule that changes CI, Vercel or permissions; the seed change fails a test; AC8 fails twice after a description fix.
- Rollback: revert the PR; no hosted state changes.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

## Appendix A. INF-002 manual QA matrix

On `npm run dev` after `npx supabase db reset`. Seed: course 1 `lam-quen-voi-html` is free and has no enrollment; course 2 `javascript-can-ban` is paid and `student@devspace.test` is enrolled; a learner reads only the exercises of an enrolled course, an admin reads all (`__tests__/rls/content.test.ts`, C4 and C5).

| ID | Account | Where | Action | Expected |
| --- | --- | --- | --- | --- |
| Q1 | `student@devspace.test` | lesson `bien-va-kieu-du-lieu` (course 2) | exercise 1: choose `let` and submit | "Chính xác!" |
| Q2 | `student@devspace.test` | same lesson | exercise 2: choose `var` and submit, then `const` | "Sai rồi, thử lại nhé", then "Chính xác!" |
| Q3 | `admin@devspace.test` | lesson `cau-truc-mot-trang-html` (course 1) | exercise 3: choose `body` and submit | "Chính xác!" |
| Q4 | `admin@devspace.test` | `/admin/lessons`, edit exercise 3 | open the edit form | the correct-answer select shows option C (`body`) |
