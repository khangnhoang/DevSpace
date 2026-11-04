# Problems, risks and follow-ups — security-hotfix

Plans: [H1](plan.md), [H2](plan-h2.md), [SH-P3 community write integrity](implementation-plans/sh-p3-community-write-integrity/plan.md). Progress: [progress.md](progress.md).

The original 2026-10-21 discovery table is preserved in Git at ddcefd0. Legacy IDs below are provenance; file-qualified mappings in scripts/docs/work-id-mappings.json resolve every old declaration. Discovery-era scheduling is historical; current State and delivery evidence live in progress.md. The Owner approved conversion of all 32 declarations on 2026-10-31, including closed forms, without changing historical plans or published SQL.

## Open

None. The program closed on 2026-11-05 (Owner decision, [ADR 0007](../../adr/0007-security-engineering-program.md)); its open entries moved to [security-engineering](../security-engineering/problems.md) or another owner, as the lines under Resolved show.

## Resolved

One line each: ID, status, historical problem and delivered outcome. Details stay in Git.

- SH-P5 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P8 (2026-11-05)
- SH-P6 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P9 (2026-11-05)
- SH-P7 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P13 (2026-11-05)
- SH-P8 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P14 (2026-11-05)
- SH-P10 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P5 (2026-11-05)
- SH-P11 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P6 (2026-11-05)
- SH-P14 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P15 (2026-11-05)
- SH-P18 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P16 (2026-11-05)
- SH-P19 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P17 (2026-11-05)
- SH-P20 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P18 (2026-11-05)
- SH-P25 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P10 (2026-11-05)
- SH-P26 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P19 (2026-11-05)
- SH-P27 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P4 (2026-11-05)
- SH-P28 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P3 (2026-11-05)
- SH-P30 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P11 (2026-11-05)
- SH-P31 — Moved to [security-engineering](../security-engineering/problems.md) as SE-P12 (2026-11-05)
- SH-P22 — Moved to [ui-ux](../ui-ux/problems.md) as UX-P2 (2026-11-05)
- SH-P23 — Resolved 2026-11-05: recorded unchanged as [UX-F4](../ui-ux/future-features.md) in ui-ux future features, because the docs checker forbids a mapping from a problem to a feature, so there is no mapping entry. Legacy P23; severity Low.
- SH-P15 — Moved to [backlog](../../backlog/problems.md) as BL-P18 (2026-11-05)
- SH-P29 — Moved to [backlog](../../backlog/problems.md) as BL-P19 (2026-11-05)
- SH-P24 — Resolved 2026-11-05: superseded by [backlog BL-F9](../../backlog/future-features.md), because the Owner will not renew the Gemini key and AI quiz generation moves to DeepSeek, which also removes the last Gemini SDK. Legacy P24; severity Low.

- SH-P3 — Resolved 2026-10-31: review INSERT authorship bound to the caller, delivered in PR #43 with local/CI behavior coverage and hosted metadata postflight; hosted mutation QA was not run at Owner direction. Legacy P3, Medium (PR 43, `dba66e5`).
- SH-P4 — Resolved 2026-10-31: comment author/lesson immutability and explicit UPDATE checks delivered with owner/admin/service-role local coverage and hosted metadata postflight; hosted mutation QA was not run at Owner direction. Legacy P4, Low (PR 43, `dba66e5`).
- SH-P32 — Resolved 2026-10-31: all 32 legacy security problem declarations converted with canonical ownership/mapping provenance, historical plans and published SQL preserved, and obsolete problems exceptions removed. Legacy AW-003, Low (PR 43, `dba66e5`).

- SH-P1 — Resolved 2026-10-22: H2-1 restricted profile PII reads. Historical problem: `profiles` SELECT `true` for `public`: anon can read the email, phone, dob, gender, province of everyone. Legacy P1; severity High; discovery-era Planned: **H2** (PR 3, `36056ec`; PR 4, `5ae5943`; H2 production matrix).
- SH-P2 — Resolved 2026-10-22: H2-1 restricted coupon reads and moved validation to the server. Historical problem: `coupons` SELECT `true` for `public`: every code can be listed; `CoursePaymentModal` checks the coupon on the client. Legacy P2; severity Medium; discovery-era Planned: **H2** (PR 3, `36056ec`; H2 production matrix).
- SH-P12 — Resolved 2026-10-21: H1 removed the fixed admin-created password. Historical problem: Fixed password `123123` when an admin creates a user — moved into H1 per Codex review round 1. Legacy P12; severity High; discovery-era Planned: H1 (PR 2, `5c842d4`).
- SH-P13 — Resolved 2026-10-22: H2-1 restricted paid lesson/quiz reads and guarded server rendering. Historical problem: Paid lesson/quiz content readable without enrolling: RLS `lessons`/`exercises` SELECT `true`; the learn page queries every lesson on the server and checks enrollment on the client (`LearnClient.tsx`) after the data is already in the RSC payload. Legacy P13; severity High; discovery-era Planned: **H2** (Owner: split into H2-1/H2-2 if large) (PR 3, `36056ec`; PR 4, `5ae5943`; H2 production matrix).
- SH-P17 — Resolved 2026-10-21: H1 aligned password rules and handled reset feedback. Historical problem: Inconsistent password rules: admin-created users ≥ 8 characters, sign-up/reset only 6; resetting to the same password currently shows the English error `same_password`. Related to the rule H1 just set (A11) → fixed in H1. Legacy P17; severity Low; discovery-era Planned: H1 (PR 2, `5c842d4`).
- SH-P21 — Resolved 2026-10-29: All nine native confirmations became ConfirmDialog in app-foundation U1; the Owner accepted the separate unverified real Gemini limit. Historical problem: Delete confirmation uses `window.confirm` (comments, admin CRUD of courses/chapters/lessons) — ugly, inconsistent with the UI — fixed in app-foundation U1: all 9 calls use `ConfirmDialog` (FEAT-006). Legacy P21; severity Low; discovery-era Planned: app-foundation U1 (PR 38, `572da83`).
- SH-P16 — Resolved 2026-11-03: the app-foundation AF-U3 profile schema turns a blank date of birth into null, closing [AF-P4](../app-foundation/problems.md#resolved) with an e2e row; H2 production check 17g stays recorded as failed on the older code. Historical problem: Updating a profile with an empty date of birth → `invalid input syntax for type date: ""` (the form sent an empty string instead of `null`). Legacy P16; severity Low; discovery-era Planned: later (PR 53, `33db042`).
- SH-P9 — Dropped 2026-11-03: leaked password protection needs the Supabase Pro plan and the project runs on Free; the Owner raised the hosted minimum password length to 8 instead. Historical problem: Leaked password protection is off (Auth settings). Legacy P9; severity Low.
