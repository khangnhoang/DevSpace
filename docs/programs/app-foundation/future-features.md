# Future features — app-foundation

Direction the Owner has set that this program delivers in a later unit. Each entry closes as `Done` in the PR that ships its last part (plan: [plan.md](plan.md), Outcomes 1 and 5).

## AF-F1: Zod, React Hook Form and shadcn in the skills

- Status: Planned (moved here on 2026-10-28 from `docs/backlog/`, where agent-workflow had moved it): `server-actions` in AF-U2 and `frontend-workflow` in AF-U3, each with its `dependency-updates` and `test-quality-strategy` rows. The U1 part is delivered by PR #38: `frontend-design` describes the shadcn primitives and the confirm dialog, and `dependency-updates` has the rows for `radix-ui` and `class-variance-authority`. The AF-U2 part is written on branch `feat/af-action-validation` and counts as delivered when that unit merges: `server-actions` describes the Zod rules (schemas in `lib/schemas/`, parse before use, the failure message and shape, blank to null), `dependency-updates` has the `zod` row, `test-quality-strategy` names the schema and action-parse unit tests and the extended worker map, and `frontend-design` no longer says there is no Zod. What stays open is the AF-U3 part: `frontend-workflow` with React Hook Form, the shared form and action contract, and the `react-hook-form` rows.
- Direction: extend `server-actions` with Zod schemas, parsing and the shared client and server contract instead of creating a second skill (agent-workflow D15); extend `frontend-workflow` with React Hook Form, shadcn controls, async state and forms (D16); update `frontend-design`, which said there was no shadcn and no UI library (done in U1). The text is written from this repository, not from VocaSpace (off limits).
- Target program: app-foundation.

## Closed

- FEAT-006 — Done: U1 replaces all nine native confirmations with the shared ConfirmDialog; the Owner accepts closure with real Gemini execution unverified due to an expired key (PR #38)
