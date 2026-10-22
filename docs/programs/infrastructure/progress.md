# Progress — infrastructure

Plan: [plan.md](plan.md). Problems: [problems.md](problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | `plan.md` r2 (2026-10-22), master plan; r1 approved by the Owner 2026-10-22, r2 only renames the units (D11). |
| Current unit / checkpoint | U2 Local database and seed ([detail plan](implementation-plans/u2-local-db/plan.md) r2), CP5 on `chore/infra-local-db` (not pushed) |
| Status | CP1 (`7b48688`) and CP2 (`c791b08`, corrections `d5e022d`, `36ff6a7`) done; Codex baseline gate PASS in round 2; first `db reset` and the AC2 diff passed. CP3 (`2aa1f44`) and CP4 (`1799212`, `d1f96e3`, correction `3161c7d`) done; Codex diff gate PASS in round 1 on `2589413..3161c7d` |
| Completed evidence | CP4 (Main, on `3161c7d`): `npx tsc --noEmit` 0, lint 81, `docs:check` 0, `docs:check:test` pass; AC6 grep clean; `git diff --check` reports only the 5 CR bytes the baseline keeps on purpose. CP3 (Main, on `2aa1f44`): `db reset` exit 0 with "Seeding data from supabase/seed.sql"; 2 `auth.users`, 2 identities, profiles 1 `admin` and 1 `user`, both named; courses price 0 and 199000; 2 chapters; 2 lessons per course; local Auth token endpoint: HTTP 200 with an access token for both users, HTTP 400 `invalid_credentials` for a wrong password. CP2 reset (Main, on `36ff6a7`): `npx supabase start` and `npx supabase db reset` exit 0, applying the baseline then 20261021131351, 20261021181051, 20261021185249; catalog snapshot (columns with defaults, generated and column ACLs; relations with RLS, force, owner, options and ACLs; constraints; indexes; view; functions with owner, security definer and ACLs; triggers including `auth.users`; policies in `public` and `storage`; default ACLs; schema `public`; bucket; storage RLS; extensions; `supabase_realtime` tables) hashed per type: 13 of 14 types equal hosted, `col` differs only in the `lessons.word_count` literal (see deviations). CP2 (Main, derivation): runbook step 1 done 2026-10-23, `supabase/dumps/hosted-schema.sql` 1471 lines, schema only (0 `COPY` or `INSERT`), no secret or URL; `supabase/.temp/project-ref` absent after unlink (G10). Throwaway stack `devspace-derive` on ports 553xx: the dump loaded with `ON_ERROR_STOP` (14 tables, 1 view, 44 public policies, 4 functions, as hosted); rollbacks h2_1b, h2_1a, h1 exit 0; result has no view, no `prevent_role_escalation`, 45 public policies; re-dumped with `db dump --local --workdir`; stack stopped. G6 objects read from hosted read-only. CP1: `npx supabase --version` 2.121.0, also with `--workdir` from the checkout; every runbook and CI command and flag exists in `--help`; lockfile diff adds only `supabase` and its dependencies (223 additions, 0 deletions); `tsc` 0, lint 81, docs:check 0; Main's clean `git archive` copy of `7b48688` with no `.env*`, `npm ci`, the three placeholders: `npm run build` exit 0. The CLI binary comes from the `@supabase/cli-<platform>` optional dependency, with no install-script download. Hosted catalog read-only on 2026-10-23 (in the plan, section 2). U1 (historical): PR 11 merged as `8f9ea0a`; push run 39822994019 on `main` passed all four jobs (lint log 81 problems); classic protection on `main` set by Main with the Owner's grant (contexts `typecheck`, `build`, `docs`, enforce admins on, no reviews, strict off) and read back; not yet tested with a failing PR |
| Accepted deviations | U2 AC2: the generated `lessons.word_count` expression stores the H2-1a file's `\uXXXX` regex escapes locally and real Unicode characters on hosted (H2-1a was applied there through the MCP); both forms split a test string with U+00A0, U+3000 and U+FEFF into the same 4 parts; no published file is changed. U2: the baseline keeps hosted's 5 CR bytes in `update_updated_at_column` (`-text` in `.gitattributes`), and SQL checks out as LF. U2: CLI 2.121.0 runs Postgres image `17.11.0.004` locally, hosted is 17.6 (same major, G3). U2 CP1: the `supabase.co` grep matches the generated `config.toml` header comment `https://supabase.com/docs/...`; no hosted URL or ref is present. `[realtime]` and `[storage.vector]` stay enabled (realtime is used by `app/components/SidebarContent.tsx`; CI exclusions are decided in CP4). U1 AC5 (historical): the lint step reports `success` under `continue-on-error`; the result is only in its log |
| Blockers / Owner decisions | none open; D13 (minimal seed) and D14 (`db` job blocks from U2) decided 2026-10-23. |
| Next action | Main opens the PR and checks CP5 on GitHub (five jobs, the `db` log, Vercel); then the Owner decides the merge |
| Current authority | Implementation granted 2026-10-23: one Sonnet session implements, local commits only. Main: state records, plus the commit of this State, a normal push of `chore/infra-local-db` and the PR (granted 2026-10-23); read-only hosted catalog queries. Merge, CI fixing, hosted writes, `migration repair` and the protection change are not granted |

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
