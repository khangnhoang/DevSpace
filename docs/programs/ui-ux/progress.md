# Progress — ui-ux

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [UX-U1](implementation-plans/ux-u1-profile-upgrade/plan.md) r2 (2026-11-03), self-reviewed, no Codex gate; approved by the Owner on 2026-11-03 (r1 approved earlier the same day). |
| Current unit / checkpoint | UX-U1 CP4 (r2: the courses section reshaped); CP1 to CP3 and the visual-review correction committed. |
| Status | Automated checks passed; Main's visual review ran on the dev stack at 375px, 768px and 1280px and its two findings (a doubled percent on the course cards, a minimum height under the phone history) are fixed; Owner manual QA M1 pending. |
| Completed evidence | CP1 `61f704f`, CP2 `9e8e955`. After the last change to writing rows: `npm run test:e2e` twice, 99 passed each; `npm test` once, 34 files and 500 tests passed; `npx tsc --noEmit` and `npm run lint` clean. |
| Accepted deviations | `getLastAccessedLessonId` also uses the shared lesson sort (it kept a third copy of it); its order is unchanged. |
| Blockers / Owner decisions | none. |
| Next action | The implementor implements CP4; then Main reviews it with the five QA courses on the dev stack and the Owner runs M1. |
| Current authority | Owner, 2026-11-03: r2 approved and committed; the implementor implements CP4 with a local commit, no push, PR or merge. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-11-03 Program opened (ADR 0006): charter, BL-F10 moved from the backlog as UX-F1 (PR 56, `e2f83c8`).
- 2026-11-03 UX-U1 r1 written for UX-F1 with the Owner decisions on the continue link, enrolled courses at 0% and the in-place list; approved by the Owner (`82c16be`).
- 2026-11-03 UX-U1 CP1 implemented: course cards with the continue link, progress order and the in-place list (`61f704f`).
- 2026-11-03 UX-U1 CP2 implemented: compact profile header, phone history blocks and Vietnamese formats (`9e8e955`).
- 2026-11-03 UX-U1 CP3: UX-F1 set to fixed locally and State updated (`1a1804b`).
- 2026-11-03 UX-U1 correction after Main's visual review: one percent per course card, and the phone history sizes to its content (`fe7bcd2`).
- 2026-11-03 UX-U1 r2 approved after the Owner's QA with five courses: a featured card plus compact rows with course images, ordered by latest activity (this commit).
