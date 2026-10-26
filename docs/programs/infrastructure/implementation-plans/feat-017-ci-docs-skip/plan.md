# FEAT-017 detail plan — Skip the database and e2e jobs on documentation-only pull requests

Revision: r2, 2026-10-26 (r2 answers Codex plan round 1: the skip condition needs a successful classifier, the docs-only list is Markdown plus one vendored file (D7), CLI tests, rollout order). Owner approval: r2 2026-10-26, after Codex plan gate PASS in round 2. Master plan or charter: [master plan](../../plan.md) (entry plan for [FEAT-017](../../future-features.md), no Units row).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: a pull request to `main` that changes only documentation skips the `db` and `e2e` jobs and can still be merged. Every other pull request, and every push to `main`, still runs all six jobs. A small Node script decides which pull requests count as docs-only, and unit tests cover it.

| ID | Observable result |
| --- | --- |
| AC1 | When a pull request to `main` changes only docs-only files (AC5), `db` and `e2e` show as skipped, `typecheck`, `build`, `docs` and `lint` run, and the pull request is mergeable under the current branch protection (all six contexts required, unchanged). |
| AC2 | When a pull request changes any file outside the AC5 list, all six jobs run. Such files include `.github/workflows/ci.yml`, files under `scripts/`, `supabase/`, `__tests__/`, `app/` and `lib/`, `package.json`, `package-lock.json`, `.claude/settings.json` and `.claude/launch.json`. A deleted file counts, and so does a file renamed away from such a path. A `.md` file counts as docs wherever it sits (D2), for example `.github/pull_request_template.md`. |
| AC3 | Every push to `main` runs all six jobs, whatever files it changes. |
| AC4 | Fail-open: `db` and `e2e` are skipped only on a `pull_request` run whose classifier job finished with result `success` and output exactly `true`. When the classifier fails (even after writing `true`), is skipped, or gives no or another output, both run. A cancelled run (a newer push to the PR) starts neither. |
| AC5 | The classifier calls a pull request docs-only only when its list of changed paths is non-empty and every path ends in `.md` (anywhere in the repository, `CLAUDE.md`, `README.md` and `.claude/rules.md` included) or is exactly `.claude/skills/playwright-cli/LICENSE` (D7). Any other file, also one under `docs/` or `.claude/skills/` (a script, an image, JSON), means not docs-only. Unit tests in `npm run test:unit` cover each part of that rule and each AC2 example, plus an empty list, a rename from code to docs, a path with a space or a newline, and a new non-Markdown file under `docs/` and `.claude/skills/`. The CLI itself is tested on NUL-separated input (mixed code and docs, empty input, malformed input), which must give `false` or a non-zero exit, never `true`. |
| AC6 | The job ids `typecheck`, `build`, `docs`, `db`, `e2e` and `lint` are unchanged, and so are the `on:` triggers, `permissions: contents: read`, and the concurrency group. The change adds no third-party action and no secret. |
| AC7 | `git-pr-workflow/references/pr-and-ci.md` (Watch CI, Record the CI result) states when `db` and `e2e` are skipped, that a skipped required job counts as passed, how to record a skipped row, and where the docs-only list lives. `CLAUDE.md` Commands keeps pointing there. |
| AC8 | Records: in infrastructure `future-features.md`, FEAT-017 stays open with Status "delivered, awaiting the first docs-only PR" until AC1 is observed, then closes in that PR's docs catch-up. Infrastructure `progress.md` State names this plan. The agent-workflow PR 24 docs catch-up ships in the same PR. |
| AC9 | On this PR, which changes `.github/` and `scripts/`, all six jobs run and pass (AC2 observed). `npx tsc --noEmit`, `npm run lint`, `npm run test:unit` and `npm run docs:check` pass locally. |

### 1.2 Scope and non-goals

- In scope: `.github/workflows/ci.yml`; a classifier script and its unit test; `pr-and-ci.md`; the records in AC8.
- Non-goals:
  - skipping `typecheck`, `build`, `docs` or `lint`;
  - changing branch protection or the required contexts;
  - path filters at the workflow level;
  - caching or speeding up `db` and `e2e`;
  - Vercel settings;
  - FEAT-014 (separate local stacks).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The docs-only list is an allowlist of Markdown files plus one named file. A path not on it means "run everything"; an empty or unreadable list also means "run everything". | A new kind of file (a config, a script, also one placed under `docs/` or `.claude/skills/`) silently skips the database and e2e tests and still shows green. |
| G2. `db` and `e2e` run unless all of these hold: the event is `pull_request`, the classifier's `result` is `success`, and its `docs_only` output is exactly `true` (for example `!cancelled() && (github.event_name != 'pull_request' or needs.changes.result != 'success' or needs.changes.outputs.docs_only != 'true')`, written with the expression `\|\|` operator). Never a bare `needs` condition. The classifier step fails when any command in its pipeline fails (`set -o pipefail`). CP2 reviews the condition against a matrix: push; PR docs-only success; PR code; classifier failed after writing `true`; classifier skipped; output missing; run cancelled. | When the classifier fails, GitHub skips the jobs that need it, a skipped required job counts as passed, and a code PR merges untested. A `true` written before a failure would skip as well. With `always()` instead of `!cancelled()`, a cancelled run would still start both jobs. |
| G3. The diff lists both the old and the new path of a rename (`--no-renames`) and is read NUL-separated (`-z`), comparing the PR's base and head commits. | Moving `app/x.ts` to `docs/x.md` shows only the docs path and skips the tests; a path with a space or newline splits wrongly. |
| G4. A push event never reads the classifier result. | A merge to `main` skips the tests that guard `main`. |
| G5. The implementor does not push, open a PR or change GitHub settings (`.claude/rules.md` section 4). Main makes no edit while the implementor is active (section 2). | A CI experiment reaches the remote without a grant, or Main's diff is committed with the implementor's. |

### 1.4 Owner decisions that bind this unit

- D1 (2026-10-26) Skip only `db` and `e2e`.
- D2 (2026-10-26) The docs-only list is the narrow list in AC5. A push to `main` always runs everything.
- D3 (2026-10-26) Detect changed files with `git diff` in the workflow; no third-party action. A workflow-level `paths:` filter is not used, because the required checks would stay pending.
- D4 (2026-10-26) The classifier is a Node script with unit tests, not inline shell.
- D5 (2026-10-26) The skip path is verified on the first real docs-only PR after the merge, not on a throwaway PR. FEAT-017 stays open until then.
- D7 (2026-10-26, after Codex plan round 1) D2's list is narrowed: a path is docs when it ends in `.md`, or when it is the vendored `.claude/skills/playwright-cli/LICENSE`. A non-Markdown file under `docs/` or `.claude/skills/` runs everything. Today those folders hold no other file.
- D6 (2026-10-26) This is a CI change, so it is high-risk (`.claude/rules.md` section 2): the Codex gate runs on this plan and on the implementation diff. It is planned as an entry plan (agent-workflow U7), without a master-plan revision.

## 2. Repository facts

Baseline: `85248b2`, checked 2026-10-26.

- `ci.yml` runs on `pull_request` and `push` to `main`, with `permissions: contents: read`. The concurrency group cancels older PR runs. The comment there says job ids are the required check names — justifies AC6.
- Branch protection on `main` requires the contexts `typecheck`, `build`, `docs`, `db`, `e2e` and `lint`, with `strict: false` (`gh api .../branches/main/protection`, read 2026-10-26) — justifies AC1, D3.
- Every job checks out with `actions/checkout@v7` at its default depth. `db` and `e2e` are the long jobs: 2m30s to 2m53s and 4m24s to 6m44s on PR 23 and PR 24; the others take 37s to 1m4s — justifies D1.
- `git ls-files docs .claude/skills` lists no non-Markdown file except `.claude/skills/playwright-cli/LICENSE` — justifies D7: every docs PR so far passes the narrowed list.
- The unit project includes `__tests__/unit/**/*.test.ts`. The existing unit tests import helpers from `__tests__/helpers` — justifies the test location in AC5.
- `pr-and-ci.md` Watch CI says "All six jobs block", and Record the CI result already has a `skipped` row form — justifies AC7.
- From GitHub's documentation, not checkable in the repo: a job skipped by its own `if:` reports success to a required check; a job whose `needs` failed is skipped; `always()` also runs on cancellation. This is why AC1 is observed after the merge (D5), and why G2 exists.

## 3. Bounded implementation hypotheses

These may change if AC1 to AC6 and G1 to G4 still hold.

- A first job (for example `changes`) that runs only on `pull_request`:
  - it checks out with `fetch-depth: 0`;
  - it runs `git diff --name-only -z --no-renames <base.sha>...<head.sha>` and pipes the result into `node scripts/ci/docs-only.mjs`;
  - it writes `docs_only=true|false` to `$GITHUB_OUTPUT`.
- `scripts/ci/docs-only.mjs` exports a pure `isDocsOnly(paths)` and a CLI that reads NUL-separated stdin and prints `true` or `false`. The test `__tests__/unit/docs-only.test.ts` imports the function and runs the CLI with fixture input; the step writes the CLI's answer to `$GITHUB_OUTPUT`, and the job maps it to `outputs.docs_only`.
- `db` and `e2e` gain `needs: changes` and the G2 condition. The other four jobs stay independent.

## 4. Checkpoints

The classifier is the easiest part to verify, so it comes first.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Classifier script and unit tests (AC5, G1, G3 path handling). | `npm run test:unit`; `npx tsc --noEmit`; `npm run lint`. |
| CP2 | Workflow (AC1 to AC4, AC6, G2, G4), `pr-and-ci.md` (AC7), records (AC8). | `npm run docs:check`; the G2 condition matrix written out in the report, row by row; `git diff` of `ci.yml`, checked against AC6. |
| CP3 | Main review of the whole diff, then the Codex diff gate. | Main reads every line; Codex (read-only) on the commit range. |

Order after CP3, each step under the Owner's grants: local checks, then this PR's CI (AC9: all six run), then the merge, then the push run on `main` (AC3: all six run), then the first docs-only PR (AC1, D5).

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A code PR is classified as docs-only and merges without the database or e2e tests. | G1 allowlist, G3 rename handling, AC5 tests, G2 fail-open, and the Codex diff gate. |
| GitHub does not count a skipped job as passed, so docs-only PRs are blocked. | This fails closed. It is seen on the first docs-only PR (D5); the fix is a revert or a follow-up, and code PRs are unaffected. |
| The classifier job is slow (a full-history checkout). | Only metadata is fetched; if it takes longer than about 30s, use a shallow fetch of the two commits instead, provided G3 holds. |
| The docs-only list drifts from the docs folders. | The list lives in one script, `pr-and-ci.md` points to it, and a change to the script runs everything. |

- Rollout runbook: this PR's CI shows all six jobs (AC9); merge (Owner grant); the push run on `main` shows all six (AC3); the next docs-only PR is the AC1 observation, recorded in that PR's docs catch-up.
- Stop when: G2 cannot be expressed with GitHub's job conditions; a needed change touches branch protection; or a test would need a hosted secret.
- Rollback: revert the PR. The workflow returns to running all six jobs, and nothing else depends on it.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
