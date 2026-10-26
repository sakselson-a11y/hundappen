-- Konton som skapades innan profiles-tabellen fanns saknar profilrad.
insert into public.profiles (id)
select u.id from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Låt appen skapa sin egen profilrad om den ändå skulle saknas.
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
