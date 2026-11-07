# Problems, risks and follow-ups — security-engineering

Charter: [README.md](README.md). Progress: [progress.md](progress.md).

Every entry below moved here on 2026-11-05 (Owner decisions 1 and 2) from the closed `security-hotfix` program or from the backlog, with its fields kept; the old homes keep a `Moved to` line and `scripts/docs/work-id-mappings.json` maps each old ID. Evidence lines that cite "Legacy P<n>" and baseline ddcefd0 are provenance of the 2026-10-21 discovery. The label "Open, before migration" means a production exposure to fix before the techstack migration: data readable or writable by the wrong actor on production today, or a write that corrupts payment, coupon or permission state on production today (the H2-2b entries SE-P8 to SE-P12 and the role constraint SE-P7); "Deferred to techstack-migration" means an acceptance criterion of that migration. On 2026-11-08 every deferred entry moved to [techstack-migration](../techstack-migration/problems.md) (its Owner decision 5).

## Open

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- SE-P2 — Resolved 2026-11-05: the activation mail escapes the learner name, the course name and the link, so markup in a name shows as plain text (PR 66, `b6f1902`); `full_name` stays without a length limit where it is saved.
- SE-P1 — Resolved 2026-11-06: PR #68 (749927bb) binds password reset to a verified recovery session; native current-password enforcement passed the local API proof, and the Owner reported the hosted control active and production recovery/sign-in passing before and after deployment.
- SE-P3 — Resolved 2026-11-07: PR #69 (`e76cc05`) blocks client email and identity changes and client profile INSERT/UPSERT; hosted migration `20261106094309` applied, and the Owner confirmed hosted acceptance and production QA.
- SE-P7 — Resolved 2026-11-07: PR #69 (`e76cc05`) enforces a validated user/admin CHECK and NOT NULL on `profiles.role`; hosted migration `20261106095706` applied, and the Owner confirmed hosted acceptance and production QA.
- SE-P6 — Resolved 2026-11-07: PR #69 (`e76cc05`) removes the unused `pg_graphql` extension after dependency checks, with an exact 1.5.11 rollback; hosted migration `20261106100209` applied, and the Owner confirmed the postflight, Advisor 0026/0027 and production QA.
- SE-P4 — Resolved 2026-11-07: PR #70 (`b03a9b4`) hides soft-deleted comments from every API role while keeping their content, requires enrollment or admin for new comments and soft-deletes through `soft_delete_comment`; hosted migration `20261106174213` applied, the catalog postflight and the D8 behavior probes passed, and the Owner confirmed production QA.
- SE-P5 — Resolved 2026-11-07: PR #70 (`b03a9b4`) limits non-admin `avatars` writes to the user's own `<uid>/` folder while admins keep any path; hosted migration `20261106175756` applied, the catalog postflight and the D8 behavior probes passed, and the Owner confirmed production QA.
- SE-P8 — Resolved 2026-11-07: PR 71 (`268545d`) and PR 72 (`8fb9b59`) add the database payment functions behind the payment actions, so coupon usage changes through apply, switch and cancel; hosted M1 and M2 applied with postflights and D5 probes, and production QA passed.
- SE-P9 — Resolved 2026-11-07: PR 71 (`268545d`) and PR 72 (`8fb9b59`) reserve a coupon use when a code is applied and release it on cancel, reject, switch or delete, in one reservation invariant; production QA passed.
- SE-P10 — Resolved 2026-11-07: PR 71 (`268545d`) makes approval and rejection act only on a pending order, with the enrollment committed in the same transaction; production QA passed.
- SE-P11 — Resolved 2026-11-07: PR 71 (`268545d`) refuses a pending order for a course the user already owns and allows one pending order per user and course; production QA passed.
- SE-P12 — Resolved 2026-11-07: PR 71 (`268545d`) applies a coupon without a use limit the same way in order creation and coupon application; PR 72 (`8fb9b59`) revokes the direct `payments` INSERT and UPDATE grants.
- SE-P13 — Moved to [techstack-migration](../techstack-migration/problems.md) as TM-P1 (2026-11-08)
- SE-P14 — Moved to [techstack-migration](../techstack-migration/problems.md) as TM-P2 (2026-11-08)
- SE-P15 — Moved to [techstack-migration](../techstack-migration/problems.md) as TM-P3 (2026-11-08)
- SE-P16 — Moved to [techstack-migration](../techstack-migration/problems.md) as TM-P4 (2026-11-08)
- SE-P17 — Moved to [techstack-migration](../techstack-migration/problems.md) as TM-P5 (2026-11-08)
- SE-P18 — Moved to [techstack-migration](../techstack-migration/problems.md) as TM-P6 (2026-11-08)
- SE-P19 — Moved to [techstack-migration](../techstack-migration/problems.md) as TM-P7 (2026-11-08)
- SE-P20 — Moved to [techstack-migration](../techstack-migration/problems.md) as TM-P8 (2026-11-08)
- SE-P21 — Moved to [techstack-migration](../techstack-migration/problems.md) as TM-P9 (2026-11-08)
- SE-P22 — Moved to [techstack-migration](../techstack-migration/problems.md) as TM-P10 (2026-11-08)
