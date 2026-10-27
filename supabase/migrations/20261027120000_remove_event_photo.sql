-- Ta bort fotot från en logg (loggen finns kvar). Får göras av den som loggade och av ägaren.
-- Returnerar fotots sökväg så att appen kan ta bort filen i Storage.

create function public.remove_event_photo(event_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  ev public.events;
begin
  select * into ev from public.events where id = event_id for update;
  if not found or not public.is_household_member(ev.household_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if ev.logged_by is distinct from auth.uid() and not public.is_household_owner(ev.household_id) then
    raise exception 'Bara den som loggade eller ägaren kan ta bort bilden' using errcode = '42501';
  end if;

  update public.events set photo_path = null where id = event_id;
  return ev.photo_path;
end;
$$;

revoke execute on function public.remove_event_photo(uuid) from public, anon;
grant execute on function public.remove_event_photo(uuid) to authenticated;
