-- security-engineering SE-U4 / SE-P5 (CP2), Owner decision D4.
-- A non-admin writes `avatars` objects only under their own `<user id>/` folder; an admin writes any path (other
-- users' avatars and course images share this bucket). Existing flat objects and public read stay untouched.
-- Rollout: applied together with se_u4_comment_integrity right after the production deploy of the code that uploads
-- learner avatars under `<user id>/` (Main applies it; the Owner grants it). The policy role stays `public` as before;
-- anon fails both folder checks because auth.uid() is null and is_admin() is false.
-- storage.objects belongs to supabase_storage_admin; hosted supautils.policy_grants lets postgres manage its policies.

begin;

drop policy "User tu upload avatar" on storage.objects;
create policy "avatars_insert_own_folder_or_admin" on storage.objects
  for insert to public
  with check (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
    )
  );

-- WITH CHECK is explicit on the new path: otherwise a rename or move could carry an owned object into another
-- user's folder, since USING only inspects the old row.
drop policy "User tu sua avatar" on storage.objects;
create policy "avatars_update_own_folder_or_admin" on storage.objects
  for update to public
  using (
    bucket_id = 'avatars'
    and (
      (owner = (select auth.uid()) and (storage.foldername(name))[1] = (select auth.uid())::text)
      or public.is_admin()
    )
  )
  with check (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
    )
  );

commit;
