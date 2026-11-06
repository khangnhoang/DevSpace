-- security-engineering SE-U3 / SE-P3: protect the system-mail identity.
-- Compatible with existing profile forms and trusted Auth/admin provisioning.
-- Main applies this restriction before merge, after independent review and separate hosted grants.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- The rollback restores these exact INSERT grants. Refuse an unexpected column/PUBLIC path.
do $$
begin
  if not has_table_privilege('anon', 'public.profiles', 'INSERT')
     or not has_table_privilege('authenticated', 'public.profiles', 'INSERT')
     or has_table_privilege('anon', 'public.profiles', 'INSERT WITH GRANT OPTION')
     or has_table_privilege('authenticated', 'public.profiles', 'INSERT WITH GRANT OPTION')
     or exists (
       select 1 from pg_class c, lateral aclexplode(c.relacl) a
       where c.oid = 'public.profiles'::regclass and a.grantee = 0
         and a.privilege_type = 'INSERT'
     )
     or exists (
       select 1 from pg_attribute c, lateral aclexplode(c.attacl) a
       where c.attrelid = 'public.profiles'::regclass
         and a.privilege_type = 'INSERT'
         and a.grantee in (0, 'anon'::regrole, 'authenticated'::regrole)
     ) then
    raise exception 'SE-U3 profile INSERT privileges differ from the reviewed snapshot';
  end if;
end;
$$;

create function public.prevent_profile_client_reassignment() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  -- No admin exemption: an admin JWT is still an untrusted client. Trusted provisioning
  -- runs as postgres; server-side maintenance uses service_role, as in H1.
  if current_user in ('anon', 'authenticated') then
    if new.email is distinct from old.email or new.id is distinct from old.id then
      raise exception 'profile email and identity cannot be changed by clients' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_profile_client_reassignment() from public, anon, authenticated;
create trigger profiles_prevent_client_reassignment before update on public.profiles
  for each row execute function public.prevent_profile_client_reassignment();

-- Blocks profile recreation and both UPSERT branches; provisioning keeps its trusted INSERT path.
revoke insert on public.profiles from anon, authenticated;

commit;
