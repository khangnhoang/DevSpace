# Progress — ui-ux

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [UX-U1](implementation-plans/ux-u1-profile-upgrade/plan.md) r1 (2026-11-03), self-reviewed, no Codex gate (no auth, permission, server action or schema change); approved by the Owner on 2026-11-03. |
| Current unit / checkpoint | UX-U1, CP1 to CP3 implemented locally; awaiting Main's review. |
| Status | Automated checks passed; the CP3 visual review was not inspected (no signed-in session in the pane); Owner manual QA M1 pending. |
| Completed evidence | CP1 `61f704f`, CP2 `9e8e955`. After the last change to writing rows: `npm run test:e2e` twice, 99 passed each; `npm test` once, 34 files and 500 tests passed; `npx tsc --noEmit` and `npm run lint` clean. |
| Accepted deviations | `getLastAccessedLessonId` also uses the shared lesson sort (it kept a third copy of it); its order is unchanged. |
| Blockers / Owner decisions | none. |
| Next action | Main reviews the diff; the Owner runs M1 (the page at 375px, 768px and desktop, signed in as the student and the learner). |
| Current authority | Owner, 2026-11-03: local checkpoint commits only; no push, PR or merge. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-11-03 Program opened (ADR 0006): charter, BL-F10 moved from the backlog as UX-F1 (PR 56, `e2f83c8`).
- 2026-11-03 UX-U1 r1 written for UX-F1 with the Owner decisions on the continue link, enrolled courses at 0% and the in-place list; approved by the Owner (`82c16be`).
- 2026-11-03 UX-U1 CP1 implemented: course cards with the continue link, progress order and the in-place list (`61f704f`).
- 2026-11-03 UX-U1 CP2 implemented: compact profile header, phone history blocks and Vietnamese formats (`9e8e955`).
- 2026-11-03 UX-U1 CP3: UX-F1 set to fixed locally and State updated (this commit).
