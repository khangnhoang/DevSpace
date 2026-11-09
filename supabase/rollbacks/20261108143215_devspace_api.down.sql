-- Rollback for techstack-migration TM-U3 / ADR 0008 D7: removes the API role and the two grants this migration made,
-- which restores the state where the role did not exist (the hosted state before this migration). It does not restore a
-- role that existed before it, nor a privilege such a role held outside the migration: DROP ROLE refuses a role that
-- still owns or holds anything, and that refusal is the signal. On hosted, set the role back to NOLOGIN first (and end
-- its connections) under a new grant; DROP ROLE also refuses a role that is in use.
begin;

revoke select (id, role) on public.profiles from devspace_api;
revoke usage on schema public from devspace_api;
drop role if exists devspace_api;

commit;
