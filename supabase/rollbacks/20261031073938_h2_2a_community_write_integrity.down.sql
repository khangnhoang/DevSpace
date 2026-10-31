-- Rollback for security-hotfix SH-P3/SH-P4, H2-2a (historical P3/P4).
-- Reopens the original write-integrity gaps; hosted use requires an explicit Owner decision.

begin;

drop trigger comments_prevent_reassign on public.comments;
drop function public.prevent_comment_reassign();

-- ALTER POLICY cannot remove WITH CHECK; recreate the exact original implicit-check policy.
drop policy "Owners and Admins can update/soft-delete comments" on public.comments;
create policy "Owners and Admins can update/soft-delete comments" on public.comments
  for update to authenticated
  using (
    auth.uid() = user_id or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'::text
    )
  );

drop policy reviews_insert_own_enrolled on public.reviews;
create policy "Only enrolled students can review" on public.reviews
  for insert to public
  with check (exists (
    select 1 from public.enrollments
    where enrollments.user_id = auth.uid() and enrollments.course_id = reviews.course_id
  ));

commit;
