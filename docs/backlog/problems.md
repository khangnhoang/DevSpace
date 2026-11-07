# Problems, risks and follow-ups — backlog

Problems that no open program owns. This is not a program: it has no plan and no progress.

## Open

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- AW-002 — Moved to [agent-workflow](../programs/agent-workflow/problems.md)
- BL-001 — Done: the docs checker treats a `Moved to` line as a pointer and the moved FEAT entries use the template lines again (PR #8)
- BL-007 — Done: README demo accounts removed and their hosted passwords rotated by the Owner (PR #21)
- BL-009 — Moved to [dependency-maintenance](../programs/dependency-maintenance/problems.md)
- BL-002 — Done: `remotePatterns` dropped `hostname: '**'` and names only the three course image hosts and the hosted Supabase Storage public path (PR #33)
- BL-008 — Done: a course without an image shows the shared `/no-course-image.png` on the home page, hero slider, course page and admin list (PR #33)
- BL-005 — Moved to [app-foundation](../programs/app-foundation/problems.md)
- BL-010 — Done: the quiz compares the selected option and the correct answer case-insensitively; hosted held no row outside `a` to `d` (PR #33)
- BL-P4 — Done: "Thử ngay" opens a lesson example with its exact code in its own language (html, javascript or cpp), other languages get no button, and a crafted link stays text until "Chạy Code"; delivered by dependency-maintenance DM-U4 (PR #49)
- BL-P8 — Done: confirming a payment shows one toast with a description instead of two stacked toasts, asserted by e2e PF9 (PR #55)
- BL-P6 — Done: the activation mail of a course with no lesson links to `/course/<slug>`, and to the home page when the slug is empty, unit-tested; delivered with security-engineering SE-P2 (PR #66)
- BL-P11 — Done: local Auth requires 8-character passwords like hosted (`minimum_password_length = 8`), and `[P13]` proves a 7-character sign-up is refused (PR #60)
- BL-P7 — Moved to [security-engineering](../programs/security-engineering/problems.md)
- BL-P9 — Moved to [security-engineering](../programs/security-engineering/problems.md)
- BL-P10 — Moved to [security-engineering](../programs/security-engineering/problems.md)
- BL-P14 — Moved to [security-engineering](../programs/security-engineering/problems.md)
- BL-P15 — Moved to [security-engineering](../programs/security-engineering/problems.md)
- BL-P16 — Moved to [security-engineering](../programs/security-engineering/problems.md)
- BL-P19 — Done: fixed by ui-ux UX-U1, `buildDashboardCourses` lists an enrolled course with nothing done at 0% (PR #57)
- BL-P2 — Done: answering the last question of a quiz shows the completion screen; quiz result persistence stays with SE-P18 (PR #73)
- BL-P3 — Done: the avatar menu closes when the user signs out, so it is closed after the next sign-in (PR #73)
- BL-P13 — Done: the admin chapters card names the course chosen in "Chuyển khóa học" and says "Chưa chọn khóa học" before one is chosen (PR #73)
- BL-P17 — Done: a failed load or reload on the transactions page shows an error with "Thử lại", clears the loader and leaves no unhandled rejection (PR #73)
- BL-P18 — Done: the transactions table and both confirm dialogs show the learner's name, email and avatar from the returned `users` relation (PR #73)
- BL-P1 — Done: the five suppressed lint lines are fixed: the images use `next/image` (the QR and the `blob:` preview `unoptimized`, the Header search image with a component-tested fallback) and the review paging reset no longer sets state in the effect (PR #76)
- BL-P5 — Moved to [techstack-migration](../programs/techstack-migration/problems.md)
- BL-P12 — Moved to [techstack-migration](../programs/techstack-migration/problems.md)
- BL-P20 — Moved to [techstack-migration](../programs/techstack-migration/problems.md)
