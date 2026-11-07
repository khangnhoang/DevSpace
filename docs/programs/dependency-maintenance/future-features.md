# Future features — dependency-maintenance

Direction the Owner has set that is outside the current scope. Work that is in scope belongs in the plan.

## DM-F2: major updates waiting

- Status: Deferred (recorded by infrastructure U7 from `npm outdated`, 2026-10-27; unchanged at the first dependency check). Moved from `docs/backlog/` on 2026-10-27 (charter decision 2).
- Direction: one initiative or task per major, each sized by `docs/agent-loops.md` Sizing and following `dependency-updates` (Major): `typescript` 5 to 7, `eslint` 9 to 10, `lucide-react` 0.x to 1, `@google/genai` 1 to 3 (latest 3.0.0 at the techstack-migration opening check, 2026-11-08; the AI quiz action moves to NestJS in TM-U8, so plan the update with it or after it), `jsdom` 30 to 31 (dev only, added 2026-11-08), the Supabase CLI (`supabase`, exact pin) 2.121.0 to 3.0.0 (added at the app-foundation closing dependency check, 2026-11-05). `nodemailer` and `@types/nodemailer` are in DM-P1. `@supabase/ssr` 0.7 to 0.12 is an auth helper and waits for the techstack migration (ADR 0001) and is removed by techstack-migration TM-U9. `recharts` deprecates `Cell` from 3.7.0 (used in `app/components/TransactionChart.tsx`) and removes it in its next major: move it to the `shape` prop of `Pie` when `recharts` 4 is planned (found in U1). The list is a snapshot: re-run `npm outdated` when a task starts.
- Target program: dependency-maintenance.

## DM-F3: `@supabase/supabase-js` minor update

- Status: Deferred (recorded at the app-foundation closing dependency check, 2026-11-05).
- Direction: 2.118.0 to 2.119.0, in range. Follow `dependency-updates` (Minor): read the release notes for behavior changes, then run the Dependency row of `test-quality-strategy`; the 2.118.0 update needed a type-only edit in `__tests__/rls/content.test.ts`, so a type check comes first. Starts on the Owner's request.
- Target program: dependency-maintenance.

## DM-F4: `@uiw/react-md-editor` minor update

- Status: Deferred (recorded at the app-foundation closing dependency check, 2026-11-05).
- Direction: 4.1.6 to 4.2.3, in range. Follow `dependency-updates` (Minor): read the release notes for behavior changes, then run the Dependency row of `test-quality-strategy` and check the admin lesson editor in a browser pass. Starts on the Owner's request.
- Target program: dependency-maintenance.

## DM-F5: `vitest` minor update

- Status: Deferred (recorded at the app-foundation closing dependency check, 2026-11-05).
- Direction: 5.0.5 to 5.1.0, in range (dev only). Follow `dependency-updates` (Minor): read the release notes for changes to projects, jsdom and the config, then run `npm run test:unit` and `npm test`. Starts on the Owner's request.
- Target program: dependency-maintenance.

## DM-F6: `@playwright/test` minor update

- Status: Deferred (recorded at the techstack-migration opening dependency check, 2026-11-08).
- Direction: 1.64.1 to 1.65.0, an exact pin. Follow `dependency-updates` (Minor) and the `@playwright/test` row: read the release notes, run `npm run test:e2e` locally, and the CI `e2e` job must pass with the browser install step unchanged. Starts on the Owner's request.
- Target program: dependency-maintenance.

## Closed

- DM-F1 — Done: production (Vercel 26.x), every CI job (through `.node-version`) and `@types/node` 26 moved to Node 26 in DM-U5; preview and production built on Node 26 and serve `/monaco/vs/loader.js` (PR #52)
