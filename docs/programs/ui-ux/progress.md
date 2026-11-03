# Progress — ui-ux

Plan: the charter `README.md` and the initiative plans under `implementation-plans/`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [UX-U1](implementation-plans/ux-u1-profile-upgrade/plan.md) r2 (2026-11-03), self-reviewed, no Codex gate; approved by the Owner on 2026-11-03 (r1 approved earlier the same day). |
| Current unit / checkpoint | None active. UX-U1 delivered in PR 57 (`186530e`). |
| Status | UX-U1 merged after green CI (run 41617399458): UX-F1 closed; the Owner passed manual QA M1 on 2026-11-03. |
| Completed evidence | UX-U1: PR 57 (`186530e`). CP1 `61f704f`, CP2 `9e8e955`, correction `fe7bcd2`, CP4 `ca8b8ca`. After the last change to writing rows (CP4): `npm run test:e2e` twice, 100 passed each; `npm test` once, 34 files and 508 tests passed; `npm run test:unit` 417 passed; `npx tsc --noEmit` and `npm run lint` clean. |
| Accepted deviations | `getLastAccessedLessonId` also uses the shared lesson sort (it kept a third copy of it); its order is unchanged. |
| Blockers / Owner decisions | none. |
| Next action | None in ui-ux; the next initiative opens from a new audit or Owner request (charter section 5). |
| Current authority | None active; the UX-U1 grants ended with its merge. |

## Milestones

One line each, newest last. No review rounds or command logs.

- 2026-11-03 Program opened (ADR 0006): charter, BL-F10 moved from the backlog as UX-F1 (PR 56, `e2f83c8`).
- 2026-11-03 UX-U1 r1 written for UX-F1 with the Owner decisions on the continue link, enrolled courses at 0% and the in-place list; approved by the Owner (`82c16be`).
- 2026-11-03 UX-U1 CP1 implemented: course cards with the continue link, progress order and the in-place list (`61f704f`).
- 2026-11-03 UX-U1 CP2 implemented: compact profile header, phone history blocks and Vietnamese formats (`9e8e955`).
- 2026-11-03 UX-U1 CP3: UX-F1 set to fixed locally and State updated (`1a1804b`).
- 2026-11-03 UX-U1 correction after Main's visual review: one percent per course card, and the phone history sizes to its content (`fe7bcd2`).
- 2026-11-03 UX-U1 r2 approved after the Owner's QA with five courses: a featured card plus compact rows with course images, ordered by latest activity (`b816171`).
- 2026-11-03 UX-U1 CP4 implemented: featured card plus compact rows with course images, ordered by latest activity, with "Chưa có bài học" and "Hoàn thành" states (`ca8b8ca`).
- 2026-11-03 UX-U1 Owner manual QA M1 passed at 375px, 768px and desktop (`8403105`).
- 2026-11-03 UX-U1 merged after green CI (run 41617399458): the profile page upgrade, UX-F1 closed (PR 57, `186530e`).
