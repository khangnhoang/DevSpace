# Future features — dependency-maintenance

Direction the Owner has set that is outside the current scope. Work that is in scope belongs in the plan.

## DM-F2: major updates waiting

- Status: Deferred (recorded by infrastructure U7 from `npm outdated`, 2026-10-27; unchanged at the first dependency check). Moved from `docs/backlog/` on 2026-10-27 (charter decision 2).
- Direction: one initiative or task per major, each sized by `docs/agent-loops.md` Sizing and following `dependency-updates` (Major): `typescript` 5 to 7, `eslint` 9 to 10, `lucide-react` 0.x to 1, `@google/genai` 1 to 2. `nodemailer` and `@types/nodemailer` are in DM-P1. `@supabase/ssr` 0.7 to 0.12 is an auth helper and waits for the techstack migration (ADR 0001). `recharts` deprecates `Cell` from 3.7.0 (used in `app/components/TransactionChart.tsx`) and removes it in its next major: move it to the `shape` prop of `Pie` when `recharts` 4 is planned (found in U1). The list is a snapshot: re-run `npm outdated` when a task starts.
- Target program: dependency-maintenance.

## Closed

- DM-F1 — Done: production (Vercel 26.x), every CI job (through `.node-version`) and `@types/node` 26 moved to Node 26 in DM-U5; preview and production built on Node 26 and serve `/monaco/vs/loader.js` (PR #52)
