# Future features — ui-ux

Direction the Owner has set that is outside the current scope. Work that is in scope belongs in the plan.

## UX-F1: Upgrade the learner profile page

- Status: Planned (Owner, 2026-11-03: a separate task after the small-task batch, with all eight findings). Moved from `docs/backlog/` as BL-F10 on 2026-11-03 (charter decision 2).
- Direction: findings of the `frontend-design` upgrade audit of `app/(main)/profile/page.tsx` on the dev stack at desktop, 768px and 375px, 2026-11-03. (1) The "Khóa học của tôi" cards link nowhere, though `DashboardCourse` has `slug`: add "Tiếp tục học". (2) At 375px the transaction table is 407px wide in a 341px frame and scrolls sideways (768px fits exactly, 523/523): show each transaction as a compact block below `md`. (3) The profile card shows "Trống" for every empty gender, date of birth and province: hide empty rows, and invite the learner to add details when all are empty. (4) At 768px the left column (`md:w-1/4`, about 180px) wraps the name and the "Chỉnh sửa hồ sơ" button. (5) At 375px the profile card is 423px tall with a 128px avatar and pushes the courses below the first screen: a compact horizontal header below `lg`, the side column from `lg`. (6) Every course is a full-width card with no limit or order: unfinished courses first, two columns from `md`, a few cards with "Xem tất cả". (7) Dates show seconds and amounts use an English separator ("199,000đ"). (8) The course title in each card is an `<h1>`. Signature element: the course cards as the way back into learning (1 and 6). Size: medium, planned as initiative UX-U1, e2e rows per part.
- Target program: ui-ux.

## Closed
