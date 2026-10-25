-- Yatra Travels: self-service account settings.
-- Every staff member can edit their own name, phone, job title and profile photo. Email, role and access stay with admins.

alter table public.profiles
  add column phone text not null default '' check (length(phone) <= 20),
  add column job_title text not null default '' check (length(job_title) <= 60),
  add column avatar_url text not null default '' check (length(avatar_url) <= 500);

grant update (phone, job_title, avatar_url) on public.profiles to authenticated;

create policy "staff update own profile" on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_staff()) with check (id = auth.uid());

-- Staff may change their own profile details; anything else (or anyone else's row) still needs an admin.
create or replace function public.guard_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
    auth.uid() <> old.id or
    (new.id, new.email, new.role, new.active, new.must_change_password, new.created_at) is distinct from
    (old.id, old.email, old.role, old.active, old.must_change_password, old.created_at)
  ) then
    raise exception 'Only admins can change staff accounts' using errcode = 'insufficient_privilege';
  end if;
  if auth.uid() = old.id and (new.role <> old.role or new.active <> old.active) then
    raise exception 'You cannot change your own role or deactivate yourself' using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- storage (profile photos, one folder per person)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp'])
on conflict (id) do nothing;

create policy "public reads avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "staff uploads own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.is_staff() and split_part(name, '/', 1) = auth.uid()::text);
create policy "staff updates own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.is_staff() and split_part(name, '/', 1) = auth.uid()::text);
create policy "staff deletes own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.is_staff() and split_part(name, '/', 1) = auth.uid()::text);
