-- Tester för att skapa hushåll med hund samt hundfoton.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

create function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FEL: %', label; end if;
  raise notice 'OK: %', label;
end $$;

insert into auth.users values
  ('00000000-0000-0000-0000-0000000000d1', 'ny@example.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'granne@example.com');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';

select pg_temp.check('ny användare har inget hushåll', (select count(*) from public.households) = 0);
select public.create_household_with_dog('  Tucci ', 'Lagotto', '2022-05-01', 'Europe/Stockholm');
select pg_temp.check('hund skapad med trimmat namn', (select name from public.dogs) = 'Tucci');
select pg_temp.check('hushåll skapat', (select count(*) from public.households) = 1);
select pg_temp.check('skaparen är ägare', (select role = 'owner' from public.household_members where user_id = auth.uid()));

do $$ begin
  perform public.create_household_with_dog('Tucci igen');
  raise exception 'FEL: kunde skapa två hushåll';
exception when raise_exception then raise notice 'OK: ett hushåll per användare';
end $$;

select public.create_household_with_dog('X', null, null, 'Inte/EnZon') from (select 1) s where false;

-- Foton
reset role;
create temp table ids as select household_id hid, id did from public.dogs where name = 'Tucci';
grant select on ids to authenticated;
set role authenticated;

insert into storage.objects (bucket_id, name)
  select 'dog-photos', hid || '/' || did || '/a.jpg' from ids;
select pg_temp.check('medlem kan ladda upp foto', (select count(*) from storage.objects) = 1);

do $$ begin
  insert into storage.objects (bucket_id, name) values ('dog-photos', 'inte-ett-id/a.jpg');
  raise exception 'FEL: ogiltig sökväg godtogs';
exception when insufficient_privilege then raise notice 'OK: ogiltig sökväg nekas';
end $$;

-- Grannen
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
select public.create_household_with_dog('Fido', null, null, 'Inte/EnZon');
select pg_temp.check('ogiltig tidszon ersätts med Europe/Stockholm',
  (select time_zone from public.households) = 'Europe/Stockholm');
select pg_temp.check('grannen ser inte Tuccis foto', (select count(*) from storage.objects) = 0);
do $$ begin
  insert into storage.objects (bucket_id, name)
    select 'dog-photos', hid || '/' || did || '/b.jpg' from ids;
  raise exception 'FEL: grannen kunde ladda upp i annat hushåll';
exception when insufficient_privilege then raise notice 'OK: kan inte ladda upp i annat hushåll';
end $$;

-- Utloggad
reset role;
set role anon;
do $$ begin
  perform public.create_household_with_dog('Anon');
  raise exception 'FEL: anon kunde skapa hushåll';
exception when insufficient_privilege then raise notice 'OK: anon kan inte skapa hushåll';
end $$;

reset role;
\echo 'Alla hushållstester gick igenom.'
