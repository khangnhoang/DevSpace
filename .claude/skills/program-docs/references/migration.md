# Migrating or reshaping a live program

Read this only when migrating a live program's docs to the current shape, reshaping a single-unit program into a multi-unit one, or making a delivery program evergreen. `SKILL.md` stays authoritative for roles, State ownership and stop conditions. Use the templates beside this file; do not copy structure from the old files.

## Procedure

1. Record the baseline: the commit that holds the old files, and the paths you will change. Confirm no other session or branch is editing them; stop if one is.
2. List what must survive. From the old files, extract every Owner decision, invariant, gate, hard rule, rollout step and open problem, with its number or ID. This is the meaning checklist.
3. Find citations that constrain paths: search `supabase/migrations/*.sql`, `AGENTS.md`, `CLAUDE.md`, `.claude/` and other docs for each path you might move. A path cited by a published migration never moves, renames or renumbers; it stays resolvable and goes on the docs-check allowlist with a reason (`security-hotfix` is the existing case). Never edit a published migration. Prefer moving nothing.
4. Write the new version from the old one, one file at a time, in the template shape:
   - master plan: keep decisions numbered and dated, invariants, units, gates and rollout order; remove State and history;
   - progress: one in-place State block with the current truth (read Git and the old State for it), then one-line milestones;
   - problems: keep every open entry and its fields; naming/owner transfers follow SKILL.md, Identifier allocation and transfers; resolved entries become one line;
   - detail plan: keep its content, numbering and path unless the reshape below applies; replace only its State section with the one-line progress pointer.
5. Preserve meaning: every checklist item appears in the new files with the same meaning. Reword only for shape. Do not re-decide, merge or drop an Owner decision, gate or rollout step. A translation changes words only: no section, ID, table row, SQL or code block is added, merged or dropped, and code blocks stay byte-identical.
6. Do not keep `_old` copies. Compare with `git show <baseline>:<path>`.
7. Run `npm run docs:check`; confirm no new broken link and that every migration-cited path still resolves.
8. Meaning check: read old and new side by side against the step 2 checklist and confirm each item is present, unchanged in meaning, and in the right file.
9. Update `docs/README.md` if a folder's purpose or a program's lifecycle changed.

## Reshape: a single-unit program gains a second unit

1. Move the root detail plan to `implementation-plans/<code>-u1-<slug>/plan.md` with its approved Spec unchanged.
2. Write a master plan at the root `plan.md` from the master-plan template: goal, numbered decisions, invariants, a unit table with both units, rollout order.
3. Fix links and the progress pointer; update State to name the new plan path and revision.
4. A path that published migrations cite never moves. Keep it in place on the allowlist and put the new unit's plan beside it instead.

## Reshape: a program becomes evergreen

Only on the Owner's decision that the program owns a long-lived capability ([ADR 0002](../../../../docs/adr/0002-program-kinds.md)). Run the Procedure steps 1 to 3 (baseline, meaning checklist, citations) first and steps 5 to 9 after; the steps below replace step 4. If Procedure step 3 finds a published migration citing the root `plan.md`, stop and report: the file cannot be deleted, so the program cannot become evergreen without the Owner's decision on that path.

1. Move the plan content to initiative plans. A single-unit root detail plan moves to `implementation-plans/<code>-u1-<slug>/plan.md` with its approved Spec unchanged. A master plan's unit plans stay where they are, with their numbers.
2. Write the charter `README.md` from the charter template: the master plan's goal becomes the capability and boundary, its decisions and invariants keep their numbers, its Units rows become Initiatives rows (closed units keep their rows), its rollout order and gates become the opening steps. Program risks that still apply go into the charter's Invariants (as the rule that prevents them) or into the initiative plan that owns them; one that fits neither is a reason to stop and report. Out-of-scope items go into the boundary.
3. Delete the root `plan.md` once the charter holds its meaning, and set the Programs row to `evergreen`.
4. Fix links to the old root plan (progress pointer, problems, other docs), and update State to name the charter and the initiative plan.

## Stop

Stop and report when an item cannot be expressed without changing its meaning, a cited path would break, or the baseline moved under the files you are migrating.

## Rollback

Fix forward on the branch before merge. After merge, prefer a small correction over a revert. A revert must leave State and milestones at their current truth and must not restore an old State block as if it were current. If another unit already started on the new shape, reconcile with the Owner before reverting.
