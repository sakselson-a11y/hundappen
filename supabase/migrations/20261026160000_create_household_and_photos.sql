-- Steg 3: skapa hushåll med hund, samt lagring av hundfoton.

-- ---------------------------------------------------------------------------
-- Skapa hushåll + hund i ett svep. Den som anropar blir ägare.
-- ---------------------------------------------------------------------------

create function public.create_household_with_dog(
  dog_name text,
  dog_breed text default null,
  dog_birth_date date default null,
  household_time_zone text default 'Europe/Stockholm'
)
returns public.dogs
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  tz text := household_time_zone;
  new_dog public.dogs;
begin
  if uid is null then
    raise exception 'Inte inloggad' using errcode = '42501';
  end if;

  -- Version 1: ett hushåll per användare. Skyddar också mot dubbeltryck.
  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'already_in_household' using errcode = 'P0001';
  end if;

  if tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = tz) then
    tz := 'Europe/Stockholm';
  end if;

  insert into public.households (name, time_zone, created_by)
    values (trim(dog_name), tz, uid)
    returning id into hid;

  insert into public.household_members (household_id, user_id, role)
    values (hid, uid, 'owner');

  insert into public.dogs (household_id, name, breed, birth_date)
    values (hid, trim(dog_name), nullif(trim(dog_breed), ''), dog_birth_date)
    returning * into new_dog;

  return new_dog;
end;
$$;

revoke execute on function public.create_household_with_dog(text, text, date, text) from public, anon;
grant execute on function public.create_household_with_dog(text, text, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Hundfoton i Storage. Sökväg: <household_id>/<dog_id>/<fil>.jpg
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dog-photos', 'dog-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Tolkar första mappen i sökvägen som hushålls-id (null om den inte är ett giltigt id).
create function public.photo_household_id(object_name text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return (string_to_array(object_name, '/'))[1]::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create policy "dog_photos_select" on storage.objects for select to authenticated
  using (bucket_id = 'dog-photos' and public.is_household_member(public.photo_household_id(name)));
create policy "dog_photos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'dog-photos' and public.is_household_member(public.photo_household_id(name)));
create policy "dog_photos_update" on storage.objects for update to authenticated
  using (bucket_id = 'dog-photos' and public.is_household_member(public.photo_household_id(name)))
  with check (bucket_id = 'dog-photos' and public.is_household_member(public.photo_household_id(name)));
create policy "dog_photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'dog-photos' and public.is_household_member(public.photo_household_id(name)));
