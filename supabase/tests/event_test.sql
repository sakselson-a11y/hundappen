-- Tester för loggar med foto och realtid.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

create function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FEL: %', label; end if;
  raise notice 'OK: %', label;
end $$;

select pg_temp.check('events ingår i realtime',
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'events'));

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'sven@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'annan@example.com');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.create_household_with_dog('Tucci');

reset role;
create temp table ids as
  select d.household_id hid, d.id did, gen_random_uuid() eid from public.dogs d;
grant select on ids to authenticated;
set role authenticated;

insert into storage.objects (bucket_id, name)
  select 'dog-photos', hid || '/events/' || eid || '.jpg' from ids;
insert into public.events (id, household_id, dog_id, type, logged_by, pee, poop, photo_path)
  select eid, hid, did, 'walk', auth.uid(), true, true, hid || '/events/' || eid || '.jpg' from ids;
select pg_temp.check('logg med foto sparas', (select photo_path is not null from public.events));
select pg_temp.check('foto i events-mappen sparas', (select count(*) from storage.objects) = 1);

update public.events set occurred_at = now() - interval '1 hour', note = 'Glömde logga';
select pg_temp.check('egen logg kan ändras', (select note = 'Glömde logga' from public.events));

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check('annan familj ser inte loggens foto', (select count(*) from storage.objects) = 0);
select pg_temp.check('annan familj ser inte loggen', (select count(*) from public.events) = 0);

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
delete from storage.objects;
delete from public.events;
select pg_temp.check('egen logg och foto kan tas bort',
  (select count(*) from public.events) = 0 and (select count(*) from storage.objects) = 0);

reset role;
\echo 'Alla loggtester gick igenom.'
