# Future features — ui-ux

Direction the Owner has set that is outside the current scope. Work that is in scope belongs in the plan.

## UX-F2: Admin tables readable on a phone without sideways scrolling

- Status: Recorded 2026-11-04 by the Owner in AF-U5 manual QA; deferred until its own initiative is approved.
- Direction: the admin tables (lessons, chapters, users, transactions) scroll sideways on a phone. Below `md`, show each row as a card with its key fields and its actions, keeping the table on larger screens, as UX-U1 did for the profile page; search, filters and pagination stay usable. Combine with UX-P1 if both are planned together.
- Target program: ui-ux.

## UX-F3: Warn before losing unsaved learner form input

- Status: Deferred (2026-11-03, Owner after app-foundation AF-U3 manual QA, as AF-F2; moved here on 2026-11-05 when app-foundation closed, Owner decision).
- Direction: a learner who leaves a form with unsaved text loses it silently. This happens when they navigate to another page, reload or close the tab. Closing the comments panel keeps the draft only because the panel slides away instead of unmounting. `app/` has no `beforeunload` handler and no navigation guard. When a learner form is dirty (React Hook Form `formState.isDirty`), warn on reload, tab close or leaving the site through `beforeunload`, which shows the browser's own prompt. For in-app navigation, which the App Router cannot block by itself, and for closing a panel or dialog, confirm through `ConfirmDialog`. Covers the profile dialog, the course review, the comment add and edit boxes and the lesson note; its e2e rows come with it.
- Target program: ui-ux.

## UX-F4: Notifications lack an explicit per-item read button

- Status: Deferred (moved from SH-P23 on 2026-11-05, Owner decision 1; found 2026-10-21 as a Low problem, a feature entry here because a mapping cannot change kind).
- Direction: Notifications have no mark-as-read button per notification (you must click the notification itself), only a button for all. Later work adds an explicit per-notification mark-as-read action alongside the existing interactions; each notification can then be explicitly marked as read while the all and read-on-click actions keep working.
- Target program: ui-ux.

## Closed

- UX-F1 — Done: the learner profile page upgrade, all eight audit findings, in UX-U1 (PR #57)
