# U1 detail plan — CI skeleton

Revision: r2, 2026-10-22 (r2 fixes the Codex round 1 findings: lint step scope, merge ref, admin enforcement, post-merge check, state-record ownership, AW-001 timing). Owner approval: 2026-10-22 (r2). Master plan: [plan.md](../../plan.md) (unit U1, decisions D4, D7 and D9).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: every pull request to `main`, and every push to `main`, runs typecheck, build, both docs checks and lint on GitHub Actions with no hosted secret and no database. Typecheck, build and docs block; the lint command runs without blocking until U6. The skills and `CLAUDE.md` describe this CI instead of "Vercel only". After merge, `main` is protected, for the Owner too, so that a pull request cannot merge while a blocking job fails.

| ID | Observable result |
| --- | --- |
| AC1 | When anyone opens or updates a pull request to `main`, GitHub Actions runs the jobs `typecheck`, `build`, `docs` and `lint` on the PR's merge ref (`refs/pull/<n>/merge`, the default `actions/checkout` ref for `pull_request`), and each reports its own check on the PR under its job id. |
| AC2 | When a commit is pushed to `main` (a merge), the same four jobs run on that commit. |
| AC3 | The `typecheck` job runs `npx tsc --noEmit`, the `build` job runs `npm run build`, and the `docs` job runs `npm run docs:check` and `npm run docs:check:test`; each job fails when its command exits non-zero. |
| AC4 | The `build` job passes on this unit's PR using only placeholder values for `NEXT_PUBLIC_SUPABASE_URL` (a local URL), `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`; no workflow file references `secrets.` or a hosted Supabase URL, and no job connects to `lkvxxrxojjlkchzzqidu`. |
| AC5 | The `lint` job runs `npm run lint` on every run; with today's 81 problems the lint step is marked failed and lists them in its log, while the `lint` job and the workflow run still succeed. A failure in the lint job's checkout, Node setup or `npm ci` fails the `lint` job. |
| AC6 | On this unit's PR, `typecheck`, `build`, `docs` and `lint` pass as checks, the lint step log shows today's 81 problems, and the Vercel check still runs as before. |
| AC7 | An agent reading `CLAUDE.md` (Commands) and `git-pr-workflow` (`SKILL.md` short form and `references/pr-and-ci.md`, Watch CI and Merge) learns which CI jobs exist, which block, that a green `lint` check does not mean lint is clean until U6 (the lint step's own result and log say that), and how to read a failed job's log; no sentence there still says the only check is the Vercel deploy. |
| AC8 | After merge and the Owner's runbook steps (section 5), a pull request to `main` cannot be merged on GitHub by anyone, the Owner included, while `typecheck`, `build` or `docs` fails or is pending; `lint` is not a required check. |

### 1.2 Scope and non-goals

- In scope (implementor): one workflow file under `.github/workflows/`; the `CLAUDE.md` Commands section; `git-pr-workflow` `SKILL.md` and `references/pr-and-ci.md`.
- In scope (Main, state records, `.claude/rules.md` section 2): this program's `progress.md`, `problems.md` (AW-001) and `future-features.md` (FEAT-004 status).
- In scope, Owner steps outside the repo: the GitHub Pro upgrade and the branch protection rule on `main` (section 5).
- Non-goals: any database, Supabase CLI or Docker step (U2); any test runner (U3, U4); fixing lint problems or a lint ratchet (U6, D4); changing product code, `package.json` scripts or dependencies; Vercel settings or deployment; the `supabase-migration` skill's deferred CI line (U2 and U3 rewrite it); caching beyond `actions/setup-node`'s npm cache; a Node version file or `engines` field.

### 1.3 Execution guardrails

Only guardrails whose omission causes a concrete failure.

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The workflow references no `secrets.*`, no `.env*` file and no hosted URL; build env values are literal placeholders that are not keys (for example `ci-placeholder-anon-key`) and the URL is `http://127.0.0.1:54321`. | A hosted secret lands in CI, or a CI run can reach production (shared invariants 1 and 3). |
| G2. Top-level `permissions: contents: read`; trigger on `pull_request` (base `main`) and `push` (branch `main`) only, never `pull_request_target`. | A workflow token with write scope, or a trigger that runs PR code with repository secrets. |
| G3. Only GitHub-owned actions (`actions/checkout`, `actions/setup-node`), pinned to a major version tag that exists when implemented. | A third-party action runs arbitrary code in CI. |
| G4. Dependencies install with `npm ci` from the committed `package-lock.json`; nothing is installed outside the lockfile. | CI tests a dependency set the repo does not record, and a passing run proves nothing about `main`. |
| G5. `continue-on-error: true` appears exactly once, on the step that runs `npm run lint`; no job and no other step uses it. | A broken typecheck, build or docs change, or a broken lint setup, shows as passing. |
| G6. Each job sets `timeout-minutes` (15 or less) and the workflow cancels a superseded run on the same PR (`concurrency` keyed on workflow and ref, cancel in progress for `pull_request` only). | A hung job burns the monthly Actions minutes of a private repo. |
| G7. Job ids are exactly `typecheck`, `build`, `docs`, `lint`, no job sets `name:`, and the docs name the same ids. | The required checks and the merge rule point at names GitHub never reports, so every PR waits on a check that never arrives. |
| G8. Skill and `CLAUDE.md` text states only what exists on `main` after this PR merges (`.claude/rules.md` section 8); branch protection is described as an Owner setting, not as something the repo enforces. | Agents rely on enforcement that is not configured yet. |

### 1.4 Owner decisions that bind this unit

- D4: lint runs without blocking until all problems are fixed in U6; no ratchet.
- D7: CI uses no hosted secret; placeholder values for the build.
- D9: the skills and `CLAUDE.md` change in this PR (FEAT-004, the U1 part), and AW-001 closes here.
- D12 (2026-10-22, new, binds this unit only): branch protection and rulesets are not available on a private repo on GitHub Free, so the Owner upgrades the account to GitHub Pro and, after U1 merges, protects `main` with classic branch protection: `typecheck`, `build` and `docs` as required status checks, enforced for administrators (`lint` is added in U6). This makes the master plan's "Owner step after merge" possible; it changes no other master-plan item.

## 2. Repository facts

Only facts that justify a Spec item or expose a conflict. Frozen after approval.

Baseline: `a58bce2`, checked 2026-10-22.

- No `.github/` directory exists; the only check on a PR is the Vercel deploy — justifies AC1, AC2.
- `gh api repos/khangnhoang/DevSpace` reports `private: true`; `.../branches/main/protection` and `.../rulesets` return HTTP 403 "Upgrade to GitHub Pro or make this repository public"; Actions are enabled with `allowed_actions: all` — justifies D12, AC8, G3, G6.
- `npx tsc --noEmit` exits 0; `npm run lint` exits 1 (81 problems); `npm run docs:check:test` passes — justifies AC3, AC5, AC6 and G5.
- A clean `git archive` copy of `a58bce2` with no `.env*` file, after `npm ci`, ran `npm run build` with only the three placeholder variables above and exited 0 (Next.js 16.0.10, 14 static pages generated) — justifies AC4 and G1.
- Module-scope clients read env at import: `lib/supabase.admin.ts`, `app/action/payment.ts`, `app/action/admin-dashboard.ts`, `app/action/enroll.ts`, `app/action/user.ts` (URL and service-role key), `lib/supabase.ts` (URL and anon key); `GEMINI_API_KEY` and `GMAIL_*` are read inside functions only — justifies the three build variables in AC4 and no others.
- The Owner's machine runs Node 24.11.1 and npm 11.6.2; `package-lock.json` is lockfile version 3; there is no `.nvmrc` or `engines` field — justifies G4 and the Node 24 hypothesis.
- `CLAUDE.md:13`, `.claude/skills/git-pr-workflow/SKILL.md:44` and `references/pr-and-ci.md:33` say there is no CI besides the Vercel deploy — justifies AC7.

## 3. Bounded implementation hypotheses

Each names what may change and which Spec or guardrail facts must stay true.

- One file `.github/workflows/ci.yml` with four parallel jobs on `ubuntu-latest`, each running the default checkout (the merge ref on `pull_request`), `actions/setup-node` with Node 24 and `cache: npm`, `npm ci`, then its command — may change (for example a shared setup step or a different file name) if AC1 to AC5 and G1 to G7 hold.
- The `build` job sets the three placeholders and `NEXT_TELEMETRY_DISABLED=1` as job `env` — may change if G1 holds and the build still needs no other variable.
- The `docs` job runs both docs scripts as two steps so a failure names which one broke — may change if AC3 holds.
- `pr-and-ci.md` Watch CI says the jobs and their blocking status, that `gh pr checks` lists them next to Vercel, that a failed job's log comes from `gh run view <id> --log-failed`, and that the lint result is read from the lint step until U6; Merge keeps "all checks pass" and adds that the lint step's failure is expected until U6. `SKILL.md` and `CLAUDE.md` get one short line each — wording may change if AC7 and G8 hold.
- How GitHub displays a failed step with `continue-on-error` (a green job with a marked step) is checked on the PR and the docs describe what is actually shown — the wording may change, AC5 may not.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | `.github/workflows/ci.yml` meets AC1 to AC5 and G1 to G7 on paper. | `git diff --check`; `grep -n "secrets\.\|pull_request_target\|supabase.co" .github/workflows/ci.yml` finds nothing; Main reruns the four job commands in a clean `git archive` copy with `npm ci` and the job env (typecheck 0, build 0, docs 0, lint 1). |
| CP2 | `CLAUDE.md` Commands, `git-pr-workflow` `SKILL.md` and `pr-and-ci.md` describe the CI (AC7, G8). | `npm run docs:check` and `npm run docs:check:test` pass; `grep -rn "no CI\|Vercel deploy check\|test-infra" CLAUDE.md .claude/skills/git-pr-workflow` shows no stale claim. |
| CP3 (on the PR, Main, before merge) | AC1, AC4, AC5 and AC6 observed on GitHub; then Main resolves AW-001 and updates FEAT-004 and State. | `gh pr checks <n>` lists the four jobs and Vercel with their states; `gh run view <id> --json headSha,event,jobs` shows event `pull_request`, the PR head SHA and four successful jobs, and the checkout step log names the merge ref; the `build` log shows the placeholder URL and no secret; the lint step log shows 81 problems; `npm run docs:check` after the state edits. |
| CP4 (after merge, Main) | AC2, then AC8 after the Owner's protection step. | `gh run list --workflow ci.yml --event push --commit <merge sha> --json conclusion,headSha` shows one successful run, and `gh run view <id> --json jobs` shows all four jobs succeeded; `gh api repos/khangnhoang/DevSpace/branches/main/protection` shows contexts `typecheck`, `build`, `docs` and `enforce_admins.enabled: true`. |

The Sonnet implementor does CP1 and CP2 as local commits and edits no state record. Main edits the state records. CP3 needs push and PR grants and is Main's; CP4 needs the merge and the Owner's protection step. The Codex gate runs on this plan and on the CP1 to CP2 diff before push.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The CI build differs from the local clean build (Linux, case-sensitive paths, a different Node patch). | The build job is part of CP3 acceptance; a Linux-only failure is a `branch-caused` or `unclear` CI result handled under Loop 3 limits, never by weakening the job. |
| Actions minutes run out on a private repo (four jobs each run `npm ci`, about 2 to 4 minutes each). | G6 timeouts and cancellation; the Pro plan raises the monthly quota; if usage becomes a problem, merging jobs is a later change, not this unit. |
| A green `lint` check is read as "lint is clean", or a lint setup failure is taken for the expected lint problems. | AC7 says the lint result is read from the lint step's outcome and log until U6; a red `lint` job means setup failed and is classified as a CI failure (`pr-and-ci.md`); `lint` is not a required check (D12). |
| Branch protection blocks Main's own `gh pr merge` when a required check is pending or misnamed. | G7 fixes the job ids; the Owner picks the required checks from the list GitHub shows after the first run, so the names match. |
| The Owner does not upgrade or does not set protection. | AC8 stays open and is recorded in State as a pending Owner step; AC1 to AC7 do not depend on it. |
| AW-001 is closed before CI has really run the docs checks. | AW-001 stays open with status "Fixed locally, awaiting CI" until CP3 shows the `docs` job passing on the PR; only then does Main resolve it with the run as evidence. |

- Rollout runbook (Owner or hosted steps, in order):
  1. Owner, any time before step 3: upgrade the GitHub account to Pro.
  2. Owner merges the U1 PR after CP3 and review; the push to `main` runs the workflow once (AC2, CP4).
  3. Owner, in GitHub Settings, Branches: add a classic branch protection rule for `main` that requires the status checks `typecheck`, `build` and `docs` (chosen from the list GitHub shows after the first run), with "Do not allow bypassing the above settings" (enforce for administrators) on and no required reviews (single-maintainer repo). Main then checks it read-only (CP4) and records AC8 in State.
- Stop when: a job needs a hosted secret, a hosted URL or a new env variable to pass; making a job pass would require a product-code, dependency or `package.json` change; the build fails on Linux for a reason that is not small and branch-caused; GitHub shows the `lint` failure as failing the run despite G5.
- Rollback: first the Owner removes the required checks (or the protection rule), because a revert PR that deletes the workflow can never report them; then revert the U1 merge commit (removes the workflow and the doc lines); nothing in the database or on Vercel changes, so nothing is irreversible. The Pro upgrade is the Owner's own account choice and is not rolled back by this unit.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
