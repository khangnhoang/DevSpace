# TM-U16 detail plan — Production gate

Revision: r4, 2026-11-28. Owner approval: r3 approved by the Owner on 2026-11-27; the r4 AC8 re-run rule approved by the Owner on 2026-11-28. Master plan or charter: [plan.md](../../plan.md) (decision 17, TM-U16 row).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: every merge to `main` runs a GitHub check `production-gate`, and Vercel assigns the production domain to that merge's deployment only after the check passes. The check passes once the commit that the Railway API reports on `/api/health` is the latest commit at or before the merged commit that touched a Railway watch path, or a descendant of it; a timeout fails it. From then on one PR may carry a change's backend and frontend, and ADR 0008 D10 and the delivery instructions say so.

Terms: `M` is the merged commit (the push's head on `main`); `W` is the latest commit on `main`'s first-parent line at or before `M` whose change against its first parent touches a path matching a Railway watch path (so a merge commit counts as itself, the commit Railway deploys, not as the branch commits inside it); `C` is the `commit` field of `GET https://devspace-lms.vercel.app/api/health`.

| ID | Observable result |
| --- | --- |
| AC1 | The pass rule is one pure function. Unit tests show: `C` equal to `W` passes; `C` a descendant of `W` passes (a backend merge Railway superseded with a later one); `C` an ancestor of `W` waits (a frontend-only merge while an earlier backend merge is still building, and the same merge after that build failed); `C` not in the history, neither ancestor nor descendant of `W`, `"unknown"`, malformed or missing waits; no `W` at all fails at once with a message. |
| AC2 | The polling loop (clock, fetch and git calls injected) is unit-tested: it passes on the first poll that satisfies AC1; a network error, a non-200 answer or a body without `ok: true` is retried, not a pass; at the deadline it exits non-zero and prints `M`, `W`, the last `C` and the last answer's status; it re-fetches `main` once before treating an unknown `C` as missing. Ordering: a run passes only after the `production-gate` runs of every earlier first-parent commit still in progress are terminal (passed, failed or timed out), and a run never passes once a run for a later first-parent commit has passed (it exits non-zero with "superseded by `<sha>`"), so two checks never pass out of merge order, re-runs included. The runs listing excludes the run's own ID; an error or a non-200 answer from the runs API is retried and never read as "no earlier run in progress". Unit tests show: a later merge sharing `W` with an earlier one waits until the earlier run ends; a re-run of an older commit after a later pass fails as superseded; a later run that passes between two polls of an earlier run makes the earlier run fail as superseded (the check is made right before every pass, not only at start); an earlier run still queued at the later run's deadline fails the later run with a message naming it. |
| AC3 | The Railway watch paths live in one repository file that the gate reads and nothing else defines. Before CP1 the Owner reads the watch paths in the Railway dashboard, the file holds exactly them, and the match (date, the paths) is a milestone in `progress.md`. ADR 0008 D10's Railway settings list names the watch paths and that file, so a dashboard change is made in both places. |
| AC4 | `.github/workflows/production-gate.yml` runs only on `push` to `main`, has one job whose check name is `production-gate`, `permissions` of only `contents: read` and `actions: read` (the automatic `GITHUB_TOKEN`, to list earlier runs for the AC2 ordering), no repository or environment secret and no `npm ci`, and cancels no earlier run. `ci.yml` keeps its trigger and jobs; only its comment about runs on `main` changes. `production-gate` is not a required pull-request check (branch protection unchanged). |
| AC5 | Feasibility, after PR1 merges: the workflow ran on PR1's merge commit and passed; the Owner sees `production-gate` offered in the Vercel Deployment Checks settings and adds it for production deployments only; a later PR preview deployment is not held by it. If the check is not offered, or it holds previews, CP3 does not start (Stop when). |
| AC6 | Proof, backend-touching merge (PR2): while Railway builds `M`, the Vercel production deployment of `M` waits on the check and the production domain keeps serving the previous deployment; the check passes when `C` reaches `M`, and the domain then serves `M`'s deployment. `progress.md` records the run link, the time from merge to pass and the Vercel state seen while waiting. |
| AC7 | Proof, frontend-only merge (the first merge after PR2 that changes no watch path): the check passes on its first poll and the production domain serves that merge's deployment. Main records it in `progress.md` with the run link in the next docs commit. |
| AC8 | Failure and recovery are documented where an agent reads them: a failed or timed-out check keeps production on the previous frontend; every later merge fails too until a backend merge that Railway deploys reaches the reported commit (fix forward, for example a revert of the broken backend change) or the Owner uses Vercel's Force Promote, an Owner-only bypass that Main records as a milestone in the owning program's `progress.md` with the deployment and the reason. A merge whose check never reports (no run started, for example during a GitHub Actions outage) is held with no timeout: the recovery is re-running the workflow for that commit once Actions works (a failed or never-reported `production-gate` run of an older commit is re-run only while no later merge's `production-gate` run is in progress or has passed, no merge to `main` happens until that re-run is terminal, and a run that passed is never re-run; otherwise the next merge recovers), the next merge (whose own deployment supersedes it), or Force Promote. A run that failed only because an earlier run was still queued at its deadline is recovered the same way, by re-running it. A live failure is not induced (reason in section 5). |
| AC9 | What a Vercel rollback, a redeploy of an older deployment and a re-run of a failed `production-gate` job do with the check is read from Vercel's docs (and, for the re-run, observed if it happens during the proofs) and recorded in ADR 0008 D10, each marked read, observed or unknown, together with whether Vercel assigns the production domain to a deployment whose check passes after a newer production deployment went live (the AC2 ordering stays either way, because it costs one API read). That includes the 2026-11-27 reading that a Hobby rollback reaches only the previous production deployment, at the routing layer without a rebuild, and stops automatic production domain assignment until a promote. |
| AC10 | ADR 0008 D10 is amended: the deploy order says one merge may carry backend and frontend once the gate is active, with decision 17's backward-compatible API rule (add first, remove in a later merge once no live frontend calls it) and the cases that still split PRs (a check on the live API before the frontend switches; the additive migration before the merge and the restrictive migration after the smoke check); both rollback paragraphs say how the gate behaves after an API rollback (the reported commit falls behind `W`, so later merges fail until a fix forward or Force Promote) and after a frontend rollback (AC9). `AGENTS.md` (Commands, CI), `pr-and-ci.md` (Watch CI and Merge: after a merge, watch the `production-gate` run until it is terminal, the merge's watch ends there, and no merge uses a skip-CI marker), the Push, PR, CI and merge short form in `git-pr-workflow` `SKILL.md`, and the `ci.yml` comment say the same. `npm run docs:check` passes. |

### 1.2 Scope and non-goals

- In scope: the gate script, its watch-path file and unit tests; the workflow; the docs of AC3, AC8, AC9 and AC10; a one-line comment in `backend/src/health/health.controller.ts` naming the gate as a reader of `commit` (a real constraint, and the backend change of the AC6 proof); the proofs and their records; the Owner's settings steps.
- Non-goals: any change to `ci.yml` jobs, required checks or branch protection; a Railway deploy hook, Railway API token or any secret; Railway "Wait for CI"; a frontend-side check of the API version; changing which paths Railway watches (a gap found while matching them is recorded in `problems.md`, not fixed here); smoke tests of features on production; TM-U5 work.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The gate passes only by the AC1 rule; no fallback passes on timeout, error or an unknown `C`. | A merge whose API is not live reaches production, which is exactly what the gate prevents. |
| G2. Railway "Wait for CI" stays off; the Owner confirms it with the watch paths (AC3). | Railway waits for `production-gate`, which waits for Railway: every backend merge deadlocks until the timeout. |
| G3. The Vercel check holds only the production domain assignment, never a preview (Owner setting, observed in AC5). | The gate never runs for a PR's head, so a held preview waits forever and the Vercel row in every PR's CI never passes. |
| G4. The watch-path file holds exactly the dashboard's paths, and the docs say a change is made in both. | A path Railway builds but the gate ignores makes `W` too old (the gate passes before the API is live); a path the gate counts but Railway ignores makes `W` unreachable (every later merge times out). |
| G5. No `concurrency` cancellation in the workflow. | A cancelled run is a non-passing check, so that merge's deployment never reaches production even when its API is live. |
| G6. The workflow reads no repository or environment secret, its `GITHUB_TOKEN` has only the AC4 read permissions, and it calls only the public production health URL and the GitHub API. | A token with more reach on a push-triggered job widens what a compromised step can do; a stored secret also needs an Owner setting this unit does not plan. |
| G7. No merge commit to `main` carries `[skip ci]`, `[skip actions]` or a similar marker (named in `pr-and-ci.md`, Merge). | No run starts, Vercel waits for a check that never reports, and that deployment is held with no timeout (AC8). |

### 1.4 Owner decisions that bind this unit

- Decision 17 (2026-11-27): the gate, its pass rule, the narrowed 2026-11-08 decision, the backward-compatible API rule and the handover to `quality-engineering` at program close.
- Decision 16 order: TM-U16 runs before TM-U5.
- Decision 18 (2026-11-27): this plan is exempt from the Codex plan round (the Opus 5.5 medium review passed it); the Codex round on the implementation diff still runs (AGENTS.md sections 2 and 3).

## 2. Repository facts

Baseline: `919f46d`, checked 2026-11-27.

- `backend/src/health/health.controller.ts` returns `{ ok: true, commit: this.env.commit }` on a public route, and `backend/src/common/env.ts` sets `commit` from `RAILWAY_GIT_COMMIT_SHA` or `"unknown"` — justifies AC1 (`"unknown"` waits) and the health URL.
- TM-U3 plan section 3 records the dashboard watch paths as `backend/**` and `lib/schemas/**`; Railway Config as Code stops reading repository files on 2026-12-01 (TM-U3 decision, `e651698`), so the dashboard is the source and the repository file is a mirror — justifies AC3 and G4.
- `.github/workflows/ci.yml` runs on `pull_request` to `main` only, with the comment "a merge commit on main gets no run of its own" — justifies AC4 and the comment change.
- `scripts/ci/docs-only.mjs` with `__tests__/unit/docs-only.test.ts` is the existing pattern of a dependency-free CI script tested by the `unit` project — justifies the script's placement and AC1.
- Progress records PR #88 merging with Railway still reporting `eeddd99` because it changed no backend file — justifies counting only watch-path commits (`W`, not `M`).
- Vercel docs (read 2026-11-27): a Hobby rollback goes only to the previous production deployment, at the routing layer without a rebuild; `vercel promote` restores automatic assignment of production domains after a rollback; `vercel project checks --blocks deployment-alias` lists the checks that hold the production alias, and the project lists none today — justifies AC5 and AC9.
- `git log` on `main` shows PRs land as merge commits ("Merge pull request #97 ...") — justifies counting the merge commit as `W`; a rebase merge is not used and would need the Railway diff-basis hypothesis below rechecked.
- `docs/programs/techstack-migration/plan.md` section 5 item 5 already says two PRs apply until the workflow is on `main` and the Owner's check is active — justifies doing the D10 amendment in PR2, after AC5.

## 3. Bounded implementation hypotheses

- `scripts/ci/production-gate.mjs` exports the pure rule and the loop and runs as `node scripts/ci/production-gate.mjs` with `M` from `GITHUB_SHA`; git ancestry is `git merge-base --is-ancestor W C`; `W` comes from `git log -1 --first-parent --format=%H M -- <pathspecs>` with `:(glob)` pathspecs built from the watch-path file — may change if AC1 and G1 hold.
- Railway builds a push when any file the push changes matches a watch path and deploys the push's head, so `RAILWAY_GIT_COMMIT_SHA` is the merge commit — confirmed by AC6 (and CP0 if the dashboard shows it); if Railway diffs only the head commit, `W`'s definition still holds for merge and squash commits, which are the only methods in use.
- The earlier-run ordering of AC2 reads `GET /repos/{owner}/{repo}/actions/workflows/production-gate.yml/runs?branch=main` with the automatic token — may change to the check-runs API if AC2 holds.
- `scripts/ci/railway-watch-paths.json` (an array of Railway glob patterns) — may change in name or format if AC3 holds and only the gate reads it.
- Deadline 20 minutes, poll every 15 seconds, job `timeout-minutes: 25`; a cache-busting query parameter on the health URL — may change once AC6 measures a real Railway build, if the deadline stays below the job timeout.
- `actions/checkout@v7` with `fetch-depth: 0` and `actions/setup-node@v7` from `.node-version`, as `ci.yml` uses them — may change if AC4 holds.
- `__tests__/unit/production-gate.test.ts` drives the loop with a fake clock, fetch and git — may change if AC1 and AC2 stay covered.
- Main observes the proofs with `gh run view`, `gh api` for the check run, `vercel project checks --blocks deployment-alias`, `vercel list --environment production` and `vercel inspect` (read-only; this plan grants them to Main) — may change to the Owner's dashboard reading if a CLI read is unavailable.

## 4. Checkpoints

One implementor writes CP1, CP2 and CP3 (PR2 on its own branch, after AC5); Main observes and records AC5, AC6 and AC7. PR1 is `ci/tm-u16-production-gate`; PR2 `ci/tm-u16-gate-activation` from `main` after PR1 merges.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP0 (Owner, before CP1) | The Owner reads the Railway dashboard: the watch paths, that "Wait for CI" is off, and roughly how long the last backend build took; Main puts them in the brief. | Main records the answer; a path list that differs from section 2 changes the file, not the rule. |
| CP1 (PR1) | The pure rule, the loop, the watch-path file and the unit tests of AC1 and AC2, each row proven by a mutation (flip the ancestry check, drop the retry, pass on timeout). | `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`, `npm run format:check -- <changed paths>` |
| CP2 (PR1) | The workflow of AC4 and the `ci.yml` comment. | `npm run lint`; `npm run docs:check`; a YAML read against AC4 and G5; the PR's CI (the gate itself cannot run before merge) |
| Merge PR1 (Owner grants) | AC5 part 1: the gate runs on the merge commit and passes. Then the Owner adds the Vercel check (AC5 part 2). | `gh run list --workflow production-gate.yml`; `vercel project checks --blocks deployment-alias`; the next PR's preview row in `gh pr checks` |
| CP3 (PR2) | The docs of AC8, AC9 and AC10, the ADR settings list of AC3, the health controller comment, and the AC3 and AC5 milestones in `progress.md`. | `npm run docs:check`, `npm run typecheck:api`, `npm run lint:api`; `npm test` and `npm run test:e2e` run in the PR's CI only, because a comment changes no behaviour (the report says so) |
| Merge PR2 (Owner grants) | AC6, recorded in the next docs commit. | `gh run view`, `vercel list --environment production`, `vercel inspect` while waiting and after the pass |
| First merge after PR2 without a watch path | AC7, recorded in the next docs commit. | `gh run view`, `vercel list --environment production` |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Vercel does not offer a check from a `push` workflow, or applies it to previews. | AC5 is the earliest trial, right after PR1, whose workflow holds nothing until the Owner adds the check; CP3 waits for it. |
| Vercel promotes an older deployment whose check passed after a newer one went live (two merges close together, usually sharing `W`). | The AC2 ordering makes a run wait for earlier runs, so checks pass in merge order; AC9 records what Vercel does with a late pass. |
| The watch-path mirror drifts from the dashboard (G4). | One file, named in the ADR settings list; a timeout message prints `W` and `C`, which points at the drift. |
| Railway is down or slow and blocks every frontend merge. | The deadline fails loud; recovery is fix forward or the Owner's Force Promote (AC8). |
| `/api/health` answers through the previous frontend's rewrite; a broken rewrite, or Vercel's firewall, bot protection or Attack Challenge Mode challenging GitHub runner addresses, looks like a missing API. | A non-200 answer waits, and the timeout message prints the status and the `server` header; the previous frontend is the live one, so the rewrite is the production path. |
| A re-run of an older run overlaps a later run (both pass, the older one last). | AC8 re-run rule, written in `pr-and-ci.md` in CP3. |
| A live failure proof would need a broken backend on production. | Not induced: the failure path is unit-tested (AC1, AC2) and documented (AC8). |

- Rollout runbook, in order: CP0 (Owner); PR1 review, Codex diff round, merge (Owner grants); Main checks AC5 part 1; the Owner adds `production-gate` in Vercel Settings, Deployment Checks, for production; Main checks AC5 part 2; CP3, review, merge PR2 (Owner grants); Main records AC6; AC7 on the next qualifying merge.
- Stop when: CP0 shows "Wait for CI" on and the Owner keeps it; AC5 fails; the gate fails on PR1's merge for a reason other than a real Railway lag; AC6 shows the domain moving before the pass, or AC6 fails (revert PR2, whose D10 text then claims an order that is not proven).
- Rollback: before the Owner adds the Vercel check, revert PR1 (nothing waits on it). After, the Owner removes the check in Vercel first, then PR1 is reverted, and D10's two-PR order applies again (the PR2 docs are reverted with it). Nothing hosted changes in data.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
