# Progress — security-engineering

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | Charter `README.md` (2026-11-05); no initiative plan yet. |
| Current unit / checkpoint | None active. |
| Status | Opened on 2026-11-05 with 22 entries transferred from `security-hotfix` and the backlog: 12 "Open, before migration" and 10 "Deferred to techstack-migration". |
| Completed evidence | Documentation only; `npm run docs:check` is recorded in the opening commit's report. |
| Accepted deviations | The opening plan moved SH-P23 to ui-ux as UX-F4; it moved as UX-P3 (a problem) because `npm run docs:check` forbids a mapping that changes kind (problem to feature). Main-approved 2026-11-05. |
| Blockers / Owner decisions | none. |
| Next action | The Owner chooses whether to open SE-U1 (H2-2b) or another "Open, before migration" entry; a detail plan and the Codex gate come first (charter section 5). |
| Current authority | None active; no code, migration or hosted step is authorized by this program's opening. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-11-05 Program opened (ADR 0007): charter, 22 security entries moved from `security-hotfix` and the backlog, H2-2b as SE-U1 (`4249815`).
- 2026-11-05 Small task SE-P2 with backlog BL-P6: the activation mail escapes the learner name, course name and link (`lib/activation-email.ts`), and its fallback link opens `/course/<slug>`; unit-tested (PR 66, `b6f1902`).
