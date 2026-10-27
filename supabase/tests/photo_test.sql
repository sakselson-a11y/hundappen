-- Tester för att ta bort foton från loggar.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

create function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FEL: %', label; end if;
  raise notice 'OK: %', label;
end $$;

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'sven@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'ester@example.com'),
  ('00000000-0000-0000-0000-00000000000e', 'erik@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'annan@example.com');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.create_household_with_dog('Tucci');
reset role;
insert into public.household_members (household_id, user_id)
  select id, u from public.households, unnest(array['00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000e']::uuid[]) u;
insert into public.events (id, household_id, dog_id, type, logged_by, photo_path)
  select ('40000000-0000-0000-0000-00000000000' || n)::uuid, household_id, id, 'walk', u, 'x/events/' || n || '.jpg'
  from public.dogs,
  (values (1, '00000000-0000-0000-0000-00000000000b'::uuid), (2, '00000000-0000-0000-0000-00000000000b'::uuid), (3, '00000000-0000-0000-0000-00000000000e'::uuid)) v(n, u);
set role authenticated;

-- Erik försöker ta bort Esters bild
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
do $$ begin
  perform public.remove_event_photo('40000000-0000-0000-0000-000000000001');
  raise exception 'FEL: medlem kunde ta bort annans bild';
exception when insufficient_privilege then raise notice 'OK: medlem kan inte ta bort annans bild';
end $$;

-- Ester tar bort sin egen
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check('egen bild: sökvägen returneras',
  public.remove_event_photo('40000000-0000-0000-0000-000000000001') = 'x/events/1.jpg');
select pg_temp.check('loggen finns kvar utan bild',
  (select photo_path is null from public.events where id = '40000000-0000-0000-0000-000000000001'));

-- Ägaren tar bort Esters andra
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.remove_event_photo('40000000-0000-0000-0000-000000000002');
select pg_temp.check('ägaren kan ta bort andras bilder',
  (select photo_path is null from public.events where id = '40000000-0000-0000-0000-000000000002'));

-- Annan familj
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  perform public.remove_event_photo('40000000-0000-0000-0000-000000000003');
  raise exception 'FEL: annan familj kunde ta bort bild';
exception when raise_exception then raise notice 'OK: annan familj kan inte ta bort bilder';
end $$;
reset role;
select pg_temp.check('Eriks bild finns kvar',
  (select photo_path is not null from public.events where id = '40000000-0000-0000-0000-000000000003'));

\echo 'Alla bildtester gick igenom.'
