# Future features — security-engineering

Direction the Owner has set that is outside the current scope. Work that is in scope belongs in the plan.

## SE-F1: Self-service password change for signed-in users

- Status: Deferred (2026-11-05, raised by the Owner while reviewing SE-U2).
- Direction: Add an account-settings entry point where a signed-in user supplies the current password, a new password and its confirmation. Enforce current-password verification at the Auth API and provide a link to the existing forgot-password flow when the user cannot supply it. The app currently has a recovery page only. SE-P1 and [SE-U2](implementation-plans/se-u2-password-recovery/plan.md) protect that recovery flow and the Auth boundary; the new account-settings interface is a separate feature. Schedule under the roadmap when the Owner selects it.
- Target program: security-engineering.

## SE-F2: Admins only reset another user's avatar to the default

- Status: Planned (2026-11-07, requested by the Owner after SE-U4 production QA; the Owner decided on 2026-11-07 to do it in the techstack migration): outstanding work that must be done, not dropped. List it whenever the Owner asks what work remains.
- Direction: The admin user form stops uploading or replacing another account's avatar; an admin may only reset it to the default avatar, and each user changes their own avatar from their profile. SE-U4 kept the admin exemption in the `avatars` Storage policies (Owner decision D4) because the admin user form and course images still write there; once the admin user form no longer uploads, the exemption can narrow to what course images need. It also removes the upload-before-create path behind SE-P22.
- Target program: the techstack migration.

## SE-F3: Accounts created by an admin get a password the admin never knows

- Status: Planned (2026-11-07, requested by the Owner after SE-U4 production QA; the Owner decided on 2026-11-07 to do it in the techstack migration): outstanding work that must be done, not dropped. List it whenever the Owner asks what work remains.
- Direction: Today the admin types the new account's password in the create form (`app/admin/users/_components/UserFormDialog.tsx`, `createNewUser` in `app/action/user.ts`), so the admin knows it. Replace this so the admin never sees a password: either send the new user an invite or set-password link from Supabase Auth (preferred, no password travels by mail), or generate a random password of at least 8 characters on the server and mail it, requiring a change at first sign-in. One shared password for every new account is rejected: anyone who learns it can sign in to any account that has not changed it.
- Target program: the techstack migration.
