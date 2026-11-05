# Future features — security-engineering

Direction the Owner has set that is outside the current scope. Work that is in scope belongs in the plan.

## SE-F1: Self-service password change for signed-in users

- Status: Deferred (2026-11-05, raised by the Owner while reviewing SE-U2).
- Direction: Add an account-settings entry point where a signed-in user supplies the current password, a new password and its confirmation. Enforce current-password verification at the Auth API and provide a link to the existing forgot-password flow when the user cannot supply it. The app currently has a recovery page only. SE-P1 and [SE-U2](implementation-plans/se-u2-password-recovery/plan.md) protect that recovery flow and the Auth boundary; the new account-settings interface is a separate feature. Schedule under the roadmap when the Owner selects it.
- Target program: security-engineering.
