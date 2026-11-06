-- Rollback for security-engineering SE-U4 / SE-P5 (CP2). Restores the two original `avatars` write policies exactly;
-- objects uploaded under `<user id>/` stay readable. No data changes.
begin;

drop policy "avatars_insert_own_folder_or_admin" on storage.objects;
create policy "User tu upload avatar" on storage.objects
  for insert to public
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy "avatars_update_own_folder_or_admin" on storage.objects;
create policy "User tu sua avatar" on storage.objects
  for update to public
  using (bucket_id = 'avatars' and auth.uid() = owner);

commit;
