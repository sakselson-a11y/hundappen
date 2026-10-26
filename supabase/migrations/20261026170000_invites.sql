-- Steg 4: inbjudningar med kod.
-- Koder sparas normaliserade (8 tecken, versaler, utan bindestreck) och visas som XXXX-XXXX.

create function public.normalize_invite_code(raw text)
returns text
language sql immutable set search_path = ''
as $$
  select upper(regexp_replace(coalesce(raw, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Skapar en ny kod för hushållet och återkallar tidigare aktiva koder. Bara ägaren.
create function public.create_invite(hid uuid)
returns public.household_invites
language plpgsql security definer set search_path = ''
as $$
declare
  -- Utan lättförväxlade tecken (0/O, 1/I/L).
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea;
  new_code text;
  invite public.household_invites;
begin
  if not public.is_household_owner(hid) then
    raise exception 'Bara ägaren kan bjuda in' using errcode = '42501';
  end if;

  update public.household_invites
    set revoked_at = now()
    where household_id = hid and revoked_at is null;

  loop
    bytes := uuid_send(gen_random_uuid());
    new_code := '';
    for i in 0..7 loop
      new_code := new_code || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
    end loop;
    begin
      insert into public.household_invites (household_id, code, created_by)
        values (hid, new_code, auth.uid())
        returning * into invite;
      return invite;
    exception when unique_violation then
      -- Mycket osannolikt; försök med en ny kod.
    end;
  end loop;
end;
$$;

-- Visar vem som bjuder in till vilken hund, utan att man behöver vara inloggad.
create function public.invite_preview(invite_code text)
returns table (dog_name text, inviter_name text)
language sql stable security definer set search_path = ''
as $$
  select
    (select d.name from public.dogs d
      where d.household_id = i.household_id and d.archived_at is null
      order by d.created_at limit 1),
    (select p.display_name from public.profiles p where p.id = i.created_by)
  from public.household_invites i
  where i.code = public.normalize_invite_code(invite_code)
    and i.revoked_at is null
    and i.expires_at > now()
    and i.use_count < i.max_uses;
$$;

-- Går med i hushållet som koden hör till. Returnerar hushållets id.
create function public.join_household(invite_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  invite public.household_invites;
begin
  if uid is null then
    raise exception 'Inte inloggad' using errcode = '42501';
  end if;

  select * into invite
    from public.household_invites
    where code = public.normalize_invite_code(invite_code)
      and revoked_at is null
      and expires_at > now()
      and use_count < max_uses
    for update;

  if not found then
    raise exception 'invalid_invite' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.household_members
             where household_id = invite.household_id and user_id = uid) then
    return invite.household_id;
  end if;

  -- Version 1: ett hushåll per användare.
  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'already_in_household' using errcode = 'P0001';
  end if;

  insert into public.profiles (id) values (uid) on conflict (id) do nothing;
  insert into public.household_members (household_id, user_id, role)
    values (invite.household_id, uid, 'member');
  update public.household_invites set use_count = use_count + 1 where id = invite.id;

  return invite.household_id;
end;
$$;

revoke execute on function public.create_invite(uuid) from public, anon;
revoke execute on function public.join_household(text) from public, anon;
revoke execute on function public.invite_preview(text) from public;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;
