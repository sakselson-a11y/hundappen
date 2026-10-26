-- Steg 10: byta ägare. (Lämna hushåll och ta bort konto sköts av Edge Function account,
-- eftersom foton i Storage också måste tas bort.)

create function public.transfer_ownership(new_owner uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  select household_id into hid
    from public.household_members
    where user_id = uid and role = 'owner';
  if hid is null then
    raise exception 'Bara ägaren kan byta ägare' using errcode = '42501';
  end if;
  if new_owner = uid then
    return;
  end if;
  if not exists (select 1 from public.household_members where household_id = hid and user_id = new_owner) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;

  update public.household_members set role = 'owner' where household_id = hid and user_id = new_owner;
  update public.household_members set role = 'member' where household_id = hid and user_id = uid;
  -- Gamla inbjudningar skapades av förra ägaren; den nya ägaren skapar nya vid behov.
  update public.household_invites set revoked_at = now() where household_id = hid and revoked_at is null;
end;
$$;

revoke execute on function public.transfer_ownership(uuid) from public, anon;
grant execute on function public.transfer_ownership(uuid) to authenticated;

-- Ägaren får inte lämna direkt (då blir hushållet ägarlöst); det går via ägarbyte eller Edge Function account.
drop policy "members_delete" on public.household_members;
create policy "members_delete" on public.household_members for delete to authenticated
  using (
    (user_id = (select auth.uid()) and role <> 'owner')
    or (user_id <> (select auth.uid()) and public.is_household_owner(household_id))
  );
