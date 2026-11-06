-- Rollback for security-engineering SE-U3 / SE-P3.
-- Reopens the previous client email/INSERT exposure; never rolls back H1.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop trigger profiles_prevent_client_reassignment on public.profiles;
drop function public.prevent_profile_client_reassignment();
grant insert on public.profiles to anon, authenticated;

commit;
