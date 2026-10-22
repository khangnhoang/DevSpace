# Admin and operations

Read this for anything under `app/admin` (dashboard, courses, chapters, lessons, users, transactions) and for any operational table, filter or confirmation.

Direction: medium latitude. Direct, readable, predictable and information-dense without clutter. Identity comes from typography, spacing rhythm, data hierarchy and state language, not landing-page effects.

Prioritize stable layouts; clear tables with filters, search, status, timestamps and overflow behavior; safe confirmations; enough context to prevent the wrong action; accessible controls; loading, empty and error states. Admin pages are guarded by `requireAdmin()` on the server, and a hidden button is not a permission (`server-actions`).

A confirmation names the affected object, the action, the consequence and whether it can be undone. Today these use `window.confirm` (P21); new destructive flows use a named confirm dialog (see `SKILL.md`). Money and enrollment actions (approve or reject a payment) show the order, the user and the course, and disable the button while pending so they cannot be sent twice.

Avoid landing-page effects, decorative backgrounds that reduce readability, hidden actions, icon controls without an accessible name and visible focus, destructive icons that confirm from the entry control or sit where a mis-tap lands, and clever interaction at the cost of predictability. Show a name, not "Ẩn danh", when the data exists (P15).
