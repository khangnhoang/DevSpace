# Problems, risks and follow-ups — ui-ux

Charter: [README.md](README.md). Progress: [progress.md](progress.md).

## Open

### UX-P1: admin pages break on tablets and their icon-only actions are small

- Status: Open (2026-11-04, found by the Owner in AF-U5 manual QA; outside AF-U5, which changed only the content forms).
- Problem: at 768px the admin sidebar stays open beside the content, so the course grid gets two narrow columns, card titles truncate and the page header's "Thêm khóa học" button is cut at the edge. The edit and delete actions on the course cards and in the admin tables are bare icons of about 20px, hard to hit on a touch screen and without a visible label.
- Evidence: Owner screenshots on the dev stack, iPad Mini 768×1024 (`/admin/courses`) and iPhone SE 375×667; the layout is `app/admin/layout.tsx` with the sidebar, the cards are in `app/admin/courses/_components/CoursesClient.tsx`.
- Direction: an audit of the admin shell at 375, 768 and desktop (`frontend-design`, Upgrade an existing screen): collapse the sidebar below `lg`, a grid that fits the remaining width, and icon actions with an accessible name and a hit area of at least 40×40px on touch widths (as the AF-U5 dialog close buttons now have).
- Exit condition: the admin pages show no clipped or overflowing content at 768px, and every icon-only action has a name and a touch-size target.

### UX-P2: Course review avatars have an extra gradient

- Status: Deferred (moved from SH-P22 on 2026-11-05, ADR 0007).
- Problem: The avatar in the course review section has a strange extra gradient background.
- Evidence: Legacy P22; severity Low; discovery-era Planned: later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Later UI work reviews the extra gradient in the course review avatar.
- Exit condition: The unintended review-avatar gradient is removed and visually checked.

### UX-P3: Notifications lack an explicit per-item read button

- Status: Deferred (moved from SH-P23 on 2026-11-05, ADR 0007).
- Problem: Notifications: there is no mark-as-read button per notification (you must click the notification itself), only a button for all.
- Evidence: Legacy P23; severity Low; discovery-era Planned: later; preserved from docs/programs/security-hotfix/problems.md at baseline ddcefd0 (discovery 2026-10-21; later discoveries retain their dates above).
- Direction: Later work adds an explicit per-notification mark-as-read action alongside the existing interactions.
- Exit condition: Each notification can be explicitly marked as read while existing all/read-on-click actions remain functional.

### UX-P4: Forgot-password form shows the sign-up heading

- Status: Open (2026-11-06, found during SE-U2 dev QA; existing login-card copy outside the recovery-session correction).
- Problem: Selecting "Quên mật khẩu?" displays the recovery-request form under "Tạo tài khoản mới" and "Đăng ký chỉ với 2 bước đơn giản", misleading a user who needs a new recovery link.
- Evidence: Main observed the mismatch at `http://127.0.0.1:3000/login` at mobile, tablet and desktop widths on `45fa3d96`. `app/(main)/login/page.tsx:20` and line 23 select sign-up copy for every view other than `login`, including `forgot`; the file is unchanged by SE-U2.
- Direction: Give the existing `forgot` view its own recovery-request heading and supporting copy without redesigning the login card.
- Exit condition: The forgot-password form has accurate recovery copy, while sign-in and sign-up retain their own headings.

### UX-P5: Password visibility toggle is outside the keyboard order

- Status: Open (2026-11-06, found during SE-U2 local QA; existing Auth control behavior outside the recovery-session correction).
- Problem: The reset form's named "Hiện mật khẩu" button has `tabIndex=-1`, so Tab skips that action. The same opt-out is used by sign-up; the observed reset toggle is only 18 by 18 CSS pixels.
- Evidence: Main's Owner-authorized managed E2E QA on `45fa3d96` recorded the toggle geometry and Tab order at four widths. `app/auth/reset-password/page.tsx:186` already passed `toggleTabIndex={-1}` at the implementation base `d6e8bcd`; `app/(main)/login/_components/SignUpForm.tsx:95` does too. `app/components/AuthFields.tsx:33` applies that value to the button, and the shared file is unchanged by SE-U2.
- Direction: In a bounded Auth accessibility task, make the visibility action keyboard reachable and review its pointer target without changing the password flow.
- Exit condition: Keyboard users can reach and activate the visibility action in reset and sign-up, with visible focus and a checked pointer target.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.
