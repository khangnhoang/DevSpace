# Progress — infrastructure

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r2 (2026-10-22), master plan; every unit plan is closed. |
| Current unit / checkpoint | none; U1 to U7 merged. |
| Status | Completed (2026-10-27): every unit merged, no open problem, the backlog reviewed with the Owner; the closing dependency check and dependency upkeep pass to `dependency-maintenance` ([ADR 0004](../../adr/0004-dependency-maintenance-program.md)). |
| Completed evidence | U1 to U7, INF-001, FEAT-017 and FEAT-018 are in their milestones; the U7 accepted deviations are recorded in `30da7c8` and `7165565`. |
| Accepted deviations | none. |
| Blockers / Owner decisions | none. Backlog review (2026-10-27): FEAT-019, FEAT-020 and BL-009 move to `dependency-maintenance`; every other backlog entry stays. |
| Next action | none; the program is closed. |
| Current authority | none. |
| Hosted state | baseline recorded as applied by `migration repair`; hosted lists 4 versions, `20261021000000_baseline` first (`list_migrations`, 2026-10-23). INF-001 has no hosted step. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-10-22 Master plan r1 written, Codex plan gate PASS in round 2, approved by the Owner (`aa6e318`).
- 2026-10-22 Program created; agent-workflow entries AW-001 and FEAT-002 to FEAT-004, and backlog FEAT-001, moved in (`7969be9`).
- 2026-10-22 Plan PR merged (PR 7, `08f72f2`).
- 2026-10-22 Units renamed from I1-I7 to U1-U7 to follow the master-plan template (`435ca73`).
- 2026-10-22 U1 detail plan r2 written, Codex plan gate PASS in round 2, approved by the Owner (`139d35f`).
- 2026-10-23 U1 merged; push run on `main` passed and `main` protection set (PR 11, `8f9ea0a`).
- 2026-10-23 U2 detail plan r2 written, Codex plan gate PASS in round 3, approved by the Owner (`2589413`).
- 2026-10-23 U2 CP1: Supabase CLI 2.121.0 pinned, local config added (`7b48688`).
- 2026-10-23 U2 CP2: pre-H1 baseline added, Codex gate PASS, first `db reset` matches hosted (`36ff6a7`).
- 2026-10-23 U2 CP3: minimal invented seed; both users sign in on the local stack (`2aa1f44`).
- 2026-10-23 U2 CP4: blocking CI job `db` and the local-stack rules and docs; Codex diff gate PASS (`3161c7d`).
- 2026-10-23 U2 merged; the push run on `main` passed all five jobs, lint 81 problems (PR 12, `49006a9`).
- 2026-10-23 U2 CP6: the Owner recorded the baseline on hosted with `migration repair` (4 hosted versions); `db` added to the required checks on `main` (PR 12, `49006a9`).
- 2026-10-23 U3 detail plan r3 written, Codex plan gate PASS in round 3, approved by the Owner (`a024531`).
- 2026-10-23 U3 CP1 to CP4: Vitest unit and rls projects, the RLS matrix with P3, P4, P28 as known bugs, the `db` job step and the `test-quality-strategy` skill; mutation check passed; Codex diff gate PASS in round 3 (`eeea2be`).
- 2026-10-23 U3 merged; CI on head `eeea2be` passed all five jobs, lint 81 problems (PR 15, `adb3262`).
- 2026-10-23 INF-001 resolved: `next` 16.4.3 and `npm audit fix`; lint baseline 82 by Owner decision (`1a13906`).
- 2026-10-23 INF-001 merged; CI on head `9abad27` passed all five jobs, lint 82 problems (PR 16, `fcf4a27`).
- 2026-10-23 U4 detail plan r2 written, Codex plan gate PASS in round 2, approved by the Owner (`96668d7`).
- 2026-10-23 U4 CP1 to CP4: Playwright smoke (22 tests), the `e2e` job, the vendored `playwright-cli` skill; plan r3 adds D23; mutation check passed; Codex diff gate PASS in round 3 (`1ba8712`).
- 2026-10-23 U4 merged; CI on head `06560e6` and the push run on `main` passed all six jobs, `e2e` included, lint 82 problems (PR 17, `34b80d9`).
- 2026-10-24 U4 rollout: the Owner added `e2e` to the required checks on `main` (`6258b7f`).
- 2026-10-24 U5 detail plan r1 written, Codex plan gate PASS in round 2, approved by the Owner (`9b3cbca`).
- 2026-10-24 U5 CP1 to CP4: server guard and mail record, direct server action calls, PF, AP, H and K4 to K8 rows; mutation check passed; Codex diff gate PASS in round 4 (`71fbf06`).
- 2026-10-24 U5 merged; CI on head `69792f9` and the push run on `main` passed all six jobs, lint 82 problems (PR 18, `b8e3e0f`).
- 2026-10-25 U6 detail plan r3 written, Codex plan gate PASS in round 3, approved by the Owner (`9e9a492`).
- 2026-10-25 U6 CP1 to CP3: `any` typed, unused code removed, five D28 suppressions, lint job blocking with `--max-warnings 0`; Codex diff gate PASS in round 2 (`a3a1a45`).
- 2026-10-25 U6 CP4: manual pass M1 to M12 and M5b passed, except that the Header image `onError` branch and the confetti canvas were not observed (no seed `image_url`; DOM check only); BL-003 to BL-006 and INF-002 recorded (`9a2e182`).
- 2026-10-25 U6 merged; CI on head `9a2e182` and the push run on `main` passed all six jobs, `lint` blocking with 0 problems (PR 19, `2b59144`).
- 2026-10-25 U6 rollout: `lint` added to the required checks on `main` at the Owner's request; `main` now requires all six jobs (`262613c`).
- 2026-10-26 FEAT-017 entry plan r2 approved after the Codex plan gate; agent-workflow PR 24 docs catch-up (`e9b6915`).
- 2026-10-26 FEAT-017 CP1: docs-only classifier `scripts/ci/docs-only.mjs` and its unit tests (`5517c63`).
- 2026-10-26 FEAT-017 CP2: `changes` job and the `db`/`e2e` skip condition in `ci.yml`, `pr-and-ci.md` and records; not run on GitHub yet (`3a820e8`).
- 2026-10-26 FEAT-017 correction `24b9745` (Codex round 1); CP3 Main review and Codex diff gate passed; State before the PR (`06c67c9`).
- 2026-10-26 FEAT-017 merged; PR CI passed all six jobs with `changes` failing as expected, the push run on `main` passed all six with `changes` skipped (PR 25, `df7e4f4`).
- 2026-10-27 FEAT-017 AC1 observed on PR 26 (`db` and `e2e` skipped, the four other jobs passed, mergeable); FEAT-017 closed (`ffaf0d3`).
- 2026-10-27 FEAT-018 merged; the push run on `main` passed all six jobs and the browser install step took 6 seconds (PR 27, `80916d6`).
- 2026-10-27 U7 detail plan r4 written with Owner decisions D1 to D7, Codex plan gate PASS in round 4, approved by the Owner; FEAT-018 closed, the install step stayed under 30 seconds on the push runs after PR 27 and PR 28 (`f12257d`).
- 2026-10-27 U7 CP1: seeded quiz answers lowercase, BL-010 opened, INF-002 resolved; `npm test` 192 and `npm run test:e2e` 46 passed, manual rows Q1 to Q4 pending for the Owner (`8e58883`).
- 2026-10-27 U7 CP2: `dependency-updates` skill, the `test-quality-strategy` Dependency row and the `code-review` and `program-docs` pointers (`b8dbc6e`).
- 2026-10-27 U7 CP3: FEAT-014 moved to the backlog, FEAT-019, FEAT-020 and BL-009 added, FEAT-001 delivered awaiting merge (`7bc78e9`).
- 2026-10-27 U7 correction after Main review: every added package adds its dependency row, INF-002 line cites its commit, milestones and deviations recorded (`30da7c8`).
- 2026-10-27 U7 CP4: Main review of `8e58883..30da7c8` passed; AC8 passed, the nodemailer planning session loaded `dependency-updates` and the BL-004 planning session loaded no skill (sessions `local_11cbcd4a`, `local_f764c8ef`) (`7165565`).
- 2026-10-27 U7 AC6: manual rows Q1 to Q4 passed on the seeded local stack, the Owner signed in as `student@devspace.test` and `admin@devspace.test` (`2cb2696`).
- 2026-10-27 U7 merged; CI on head `2cb2696` passed all six jobs (PR 29, `3ea4a09`).
- 2026-10-27 Program closed: FEAT-001 done, the closing dependency check recorded in `dependency-maintenance`, the backlog reviewed with the Owner, the capability handed to `dependency-maintenance` (ADR 0004) (82db821).
