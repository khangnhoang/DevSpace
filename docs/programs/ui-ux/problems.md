# Problems, risks and follow-ups — ui-ux

Charter: [README.md](README.md). Progress: [progress.md](progress.md).

## Open

### UX-P1: admin pages break on tablets and their icon-only actions are small

- Status: Open (2026-11-04, found by the Owner in AF-U5 manual QA; outside AF-U5, which changed only the content forms).
- Problem: at 768px the admin sidebar stays open beside the content, so the course grid gets two narrow columns, card titles truncate and the page header's "Thêm khóa học" button is cut at the edge. The edit and delete actions on the course cards and in the admin tables are bare icons of about 20px, hard to hit on a touch screen and without a visible label.
- Evidence: Owner screenshots on the dev stack, iPad Mini 768×1024 (`/admin/courses`) and iPhone SE 375×667; the layout is `app/admin/layout.tsx` with the sidebar, the cards are in `app/admin/courses/_components/CoursesClient.tsx`.
- Direction: an audit of the admin shell at 375, 768 and desktop (`frontend-design`, Upgrade an existing screen): collapse the sidebar below `lg`, a grid that fits the remaining width, and icon actions with an accessible name and a hit area of at least 40×40px on touch widths (as the AF-U5 dialog close buttons now have).
- Exit condition: the admin pages show no clipped or overflowing content at 768px, and every icon-only action has a name and a touch-size target.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.
