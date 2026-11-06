-- Rollback for security-engineering SE-U3 / SE-P7; preserves the user default and M1/H1.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table public.profiles drop constraint profiles_role_allowed;
alter table public.profiles alter column role drop not null;
commit;
