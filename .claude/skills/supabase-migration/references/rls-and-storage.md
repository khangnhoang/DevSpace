# RLS, grants and Storage

Read this when changing or reviewing a policy, a permission helper, a grant, a bucket or Storage access. The core rules are in `SKILL.md`.

## RLS

- Inspect the existing policies and helpers first (`public.is_admin()` and others in the snapshot); reuse a helper that expresses the same boundary. Use the real definitions, not assumed names.
- For every affected command (SELECT, INSERT, UPDATE, DELETE) state what the `USING` predicate and the `WITH CHECK` predicate allow. An UPDATE policy without `with_check` lets the owner change ownership columns such as `user_id` (P4).
- An INSERT policy that checks only a related fact (enrollment) without `user_id = auth.uid()` lets a user write as someone else (P3).
- Permissive policies on the same command are OR-ed. Replacing a policy means dropping the old one by exact name.
- Test an allowed and a denied actor for each command. Consider anon, a learner who has not enrolled, an enrolled learner, the owner of the row, another user and admin.
- Do not make a policy broader than the contract. Public data exposed through a view or column grant must be named and justified.

## Grants

- Grants are a second boundary under RLS. Check table-level and column-level grants for `anon` and `authenticated` in the snapshot before relying on a policy.
- Column-level restriction: revoke the table-level privilege, then grant the allowed columns (a column revoke does nothing while the table grant exists). Writes keep working only if their grants are untouched, so say so in the migration.
- New views and functions start with default privileges that include writes; revoke first, grant explicitly. See the traps in `SKILL.md`.

## Storage

- Inspect the bucket's policies and the upload code before changing access. Keep owner and admin checks.
- Public read only when the product needs public URLs. Do not trust a client-sent bucket name or path; prefer server-generated paths for sensitive uploads. The `avatars` bucket currently allows any signed-in user to write any path (P10); do not widen it, and record changes against that problem.

## Verification details

For each RLS or grant change: allowed role, denied role, allowed and denied path per command including `USING` and `WITH CHECK`, ownership and admin cases, and private or removed rows where relevant. Main runs them as simulated-role SQL or REST calls on the hosted database after approval; until then they are `pending`.
