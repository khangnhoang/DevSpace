# Progress — infrastructure

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r2 (2026-10-22), master plan; no unit detail plan active. |
| Current unit / checkpoint | none active; U3 merged (PR 15, `adb3262`). INF-001 security update on `chore/security-update`, a small task outside the unit plan (Owner decision 2026-10-23). |
| Status | INF-001 update done, all checks passed; not pushed. |
| Completed evidence | INF-001 on `chore/security-update` from `adb3262`: `next` and `eslint-config-next` 16.4.3, then `npm audit fix` without `--force`. `npm audit --omit=dev` 17 findings (1 critical, 8 high, 8 moderate) to 5 (`dompurify` critical, `nodemailer` high, 2 moderate, 1 low; none with an in-range fix, listed in FEAT-001). `npm run build` exit 0; `npx tsc --noEmit` exit 0; `npm run lint` 82 problems; `npx supabase db reset` exit 0; `npm test` 9 files, 94 tests, with the `known bug P3/P4/P28` lines. Browser pass on `next dev` against hosted data with the Owner signed in as admin, read only: home, course detail, `try_it`, login, profile, a lesson, admin dashboard, courses and users render with no server error. |
| Accepted deviations | `npm run lint` 81 to 82: `eslint-config-next` 16.4.x requires `eslint-plugin-react-hooks` ^7.1.0, whose `set-state-in-effect` now also flags existing code at `app/(main)/course/[slug]/page.tsx:117`; the Owner accepted 82 (2026-10-23) and U6 fixes it with the rest. `next` 16.4.3 instead of 16.4.2: it was released during the work and is the latest 16.x. |
| Blockers / Owner decisions | none. |
| Next action | With the Owner's grants, Main commits, pushes `chore/security-update`, opens the PR and writes the CI result into its body; then the U4 detail plan. |
| Current authority | the INF-001 update (plan approved 2026-10-23). Push, PR creation and merge are not granted. |
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
- 2026-10-23 INF-001 resolved: `next` 16.4.3 and `npm audit fix`; lint baseline 82 by Owner decision (this commit).
