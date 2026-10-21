-- H1 security hotfix: block privilege escalation to admin.
-- See docs/programs/security-hotfix/plan.md section 4.1.
-- Not applied by the implementor; applied to the hosted DB after Owner approval.

begin;

-- 1. New users always start as 'user'. The role in raw_user_meta_data is
--    client-controlled (auth.signUp options.data), so it must never be trusted.
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path = ''
as $function$
begin
  insert into public.profiles (id, email, full_name, avatar_url, phone, gender, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'gender',
    'user'
  );
  return new;
end;
$function$;

-- 2. Same logic as before, with a pinned search_path.
create or replace function public.is_admin()
 returns boolean
 language plpgsql
 security definer
 set search_path = ''
as $function$
begin
  return exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
end;
$function$;

-- 3. Pin the search_path of the existing updated_at trigger function.
alter function public.update_updated_at_column() set search_path = '';

-- 4. Trigger guard against role escalation on profiles.
--
-- SECURITY INVOKER on purpose: current_user is then the role that is really
-- executing the statement:
--   * anon / authenticated  -> PostgREST requests made with the anon key or a user JWT
--   * service_role          -> the service key (e.g. createNewUser promoting an admin)
--   * postgres              -> the dashboard, and the body of handle_new_user()
--                              (a security definer function owned by postgres)
-- Only anon/authenticated are restricted, and authenticated admins (is_admin())
-- are let through, so the admin UI can still change other users' roles.
-- With SECURITY DEFINER, current_user would always be the function owner
-- (postgres) and the guard would never block anything.
create or replace function public.prevent_role_escalation()
 returns trigger
 language plpgsql
 set search_path = ''
as $function$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role is distinct from 'user' then
      raise exception 'not allowed to set profiles.role' using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      raise exception 'not allowed to change profiles.role' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists prevent_role_escalation on public.profiles;
create trigger prevent_role_escalation
  before insert or update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- 5. handle_new_user is only meant to be fired by the auth.users trigger.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- is_admin() stays executable: RLS policies call it as 'authenticated'.

commit;
