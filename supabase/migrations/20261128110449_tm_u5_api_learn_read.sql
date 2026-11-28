-- techstack-migration TM-U5 / ADR 0008 D7: the columns the API reads for the /learn access gate, the lesson with its
-- private columns and the course outline.
-- Column grants only, never a table grant (supabase-migration, trap 3). The API role bypasses RLS, so these grants are
-- the whole boundary of what the learn routes can read: the handlers decide access themselves (enrollment row or admin
-- role) before they select lessons.content or lessons.video_url. Anon and authenticated keep their current privileges:
-- this migration touches no other role, table or policy, and other unmoved readers still use the Data API.
-- Rollout: additive, applied before the PR merges; the frontend calls the routes only after the merge.

begin;

-- The role holds nothing on these columns today (the TM-U3 and TM-U4 migrations never grant them), so this only makes
-- the starting point explicit before the exact grants, and lets the rollback restore the earlier state exactly.
revoke all (order_index, created_at, content, video_url) on public.lessons from devspace_api;
revoke all (user_id, course_id) on public.enrollments from devspace_api;
revoke all (lesson_id) on public.exercises from devspace_api;

-- Outline order (order_index, created_at) and the private columns, selected only after the access decision.
grant select (order_index, created_at, content, video_url) on public.lessons to devspace_api;
-- The access decision: the caller's own enrollment row, matched on both columns.
grant select (user_id, course_id) on public.enrollments to devspace_api;
-- The has-exercise marker is a count on lesson_id; no question or answer column is granted.
grant select (lesson_id) on public.exercises to devspace_api;

commit;
