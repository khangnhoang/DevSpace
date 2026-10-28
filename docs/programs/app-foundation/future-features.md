# Future features — app-foundation

Direction the Owner has set that this program delivers in a later unit. Each entry closes as `Done` in the PR that ships its last part (plan: [plan.md](plan.md), Outcomes 1 and 5).

## FEAT-005: Zod, React Hook Form and shadcn in the skills

- Status: Planned (moved here on 2026-10-28 from `docs/backlog/`, where agent-workflow had moved it): `server-actions` in U2 and `frontend-workflow` in U3, each with its `dependency-updates` and `test-quality-strategy` rows. The U1 part is done on `feat/af-confirm-dialog`: `frontend-design` describes the shadcn primitives and the confirm dialog, and `dependency-updates` has the rows for `radix-ui` and `class-variance-authority`.
- Direction: extend `server-actions` with Zod schemas, parsing and the shared client and server contract instead of creating a second skill (agent-workflow D15); extend `frontend-workflow` with React Hook Form, shadcn controls, async state and forms (D16); update `frontend-design`, which said there was no shadcn and no UI library (done in U1). The text is written from this repository, not from VocaSpace (off limits).
- Target program: app-foundation.

## FEAT-006: Replace `window.confirm` with a Dialog

- Status: Fixed locally, awaiting delivery: U1 on `feat/af-confirm-dialog` replaced the 9 calls with `ConfirmDialog`; it closes as `Done` with the PR number once the PR exists (moved here on 2026-10-28 from `docs/backlog/`, where agent-workflow had moved it).
- Direction: replace the 9 `window.confirm` calls (comments, admin courses, chapters, lessons, users and transactions; plan Appendix A) with one named confirm dialog that shows the object, the action and its consequence, with a pending state (`frontend-design`, Confirm dialogs). Tracked as P21 in `security-hotfix/problems.md`, which closes with it.
- Target program: app-foundation.
