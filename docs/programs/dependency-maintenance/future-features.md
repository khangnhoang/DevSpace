# Future features — dependency-maintenance

Direction the Owner has set that is outside the current scope. Work that is in scope belongs in the plan.

## DM-F1: Node 26 for production, CI and `@types/node`

- Status: Deferred until Node 26 enters LTS (scheduled 2026-10-28); Owner decision D3 of infrastructure U7 (2026-10-27) and the Owner decision of 2026-10-23. Moved from `docs/backlog/` on 2026-10-27 (charter decision 2).
- Direction: move the three places that set the Node major to 26 in one initiative, skipping 24: the Vercel production setting, `node-version` in every job of `.github/workflows/ci.yml`, and `@types/node`. They differ today (Vercel `22.x`, CI 24, `@types/node` `^22`), and the `dependency-updates` Node row requires one major; the Owner's machine follows. Codex-gated because it changes CI and deploy (`.claude/rules.md` section 3). Out of this entry: an `engines` field or `.nvmrc` unless the initiative's plan decides it.
- Target program: dependency-maintenance (its own initiative).

## DM-F2: major updates waiting

- Status: Deferred (recorded by infrastructure U7 from `npm outdated`, 2026-10-27; unchanged at the first dependency check). Moved from `docs/backlog/` on 2026-10-27 (charter decision 2).
- Direction: one initiative or task per major, each sized by `docs/agent-loops.md` Sizing and following `dependency-updates` (Major): `typescript` 5 to 7, `eslint` 9 to 10, `lucide-react` 0.x to 1, `@google/genai` 1 to 2. `nodemailer` and `@types/nodemailer` are in DM-P1, `@types/node` in DM-F1. `@supabase/ssr` 0.7 to 0.12 is an auth helper and waits for the techstack migration (ADR 0001). `recharts` deprecates `Cell` from 3.7.0 (used in `app/components/TransactionChart.tsx`) and removes it in its next major: move it to the `shape` prop of `Pie` when `recharts` 4 is planned (found in U1). The list is a snapshot: re-run `npm outdated` when a task starts.
- Target program: dependency-maintenance.
