-- security-engineering SE-U3 / SE-P7: every profile has exactly user/admin role.
-- Compatible with existing forms and H1 provisioning; apply before merge under separate hosted grants.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.profiles in access exclusive mode;
do $$
begin
  -- Rollback may remove only the constraint/nullability introduced here.
  if exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_role_allowed')
     or (select attnotnull from pg_attribute where attrelid = 'public.profiles'::regclass and attname = 'role')
     or (select pg_get_expr(d.adbin, d.adrelid) from pg_attrdef d join pg_attribute a
         on a.attrelid = d.adrelid and a.attnum = d.adnum
         where a.attrelid = 'public.profiles'::regclass and a.attname = 'role') is distinct from '''user''::text' then
    raise exception 'SE-U3 profile role catalog differs from the reviewed snapshot';
  end if;
  if exists (select 1 from public.profiles where role is null or role not in ('user', 'admin')) then
    raise exception 'SE-U3 invalid existing profile roles; stop for an Owner-approved repair';
  end if;
end;
$$;

alter table public.profiles add constraint profiles_role_allowed check (role in ('user', 'admin')) not valid;
alter table public.profiles validate constraint profiles_role_allowed;
alter table public.profiles alter column role set not null;
commit;
