-- RLS-tester: två familjer som inte ska se varandras data.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'sven@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'ester@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'annan@example.com');

insert into public.households (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Familjen A'),
  ('10000000-0000-0000-0000-000000000002', 'Familjen C');
insert into public.household_members (household_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'member'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'owner');
insert into public.dogs (id, household_id, name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Tucci'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Fido');

create function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FEL: %', label; end if;
  raise notice 'OK: %', label;
end $$;

-- Profiler skapas automatiskt
select pg_temp.check('profil skapas vid registrering', (select count(*) from public.profiles) = 3);

-- Utloggad
set role anon;
do $$ begin
  perform 1 from public.dogs;
  raise exception 'FEL: anon kunde läsa dogs';
exception when insufficient_privilege then raise notice 'OK: anon nekas';
end $$;
reset role;

-- Ester (medlem i A)
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check('Ester ser bara Tucci', (select array_agg(name) from public.dogs) = '{Tucci}');
select pg_temp.check('Ester ser sitt hushåll', (select count(*) from public.households) = 1);
select pg_temp.check('Ester ser profiler i sitt hushåll (2)', (select count(*) from public.profiles) = 2);
update public.profiles set display_name = 'Ester' where id = auth.uid();
update public.profiles set display_name = 'Hackad' where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check('Ester kan inte byta andras namn',
  (select display_name is null from public.profiles where id = '00000000-0000-0000-0000-00000000000a'));

insert into public.events (household_id, dog_id, type, logged_by, pee, poop)
  values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'walk', auth.uid(), true, false);
select pg_temp.check('Ester kan logga rastning', (select count(*) from public.events) = 1);

do $$ begin
  insert into public.events (household_id, dog_id, type, logged_by)
    values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'meal', '00000000-0000-0000-0000-00000000000a');
  raise exception 'FEL: Ester kunde logga i Svens namn';
exception when insufficient_privilege then raise notice 'OK: kan inte logga i någon annans namn';
end $$;

do $$ begin
  insert into public.events (household_id, dog_id, type, logged_by)
    values ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'walk', auth.uid());
  raise exception 'FEL: Ester kunde logga i annat hushåll';
exception when insufficient_privilege then raise notice 'OK: kan inte logga i annat hushåll';
end $$;

do $$ begin
  insert into public.events (household_id, dog_id, type, logged_by)
    values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'walk', auth.uid());
  raise exception 'FEL: Ester kunde logga på annan familjs hund';
exception when foreign_key_violation then raise notice 'OK: hund måste tillhöra hushållet';
end $$;

do $$ begin
  update public.household_members set role = 'owner' where user_id = auth.uid();
  raise exception 'FEL: Ester kunde göra sig själv till ägare';
exception when insufficient_privilege then raise notice 'OK: kan inte ändra sin roll';
end $$;
update public.household_members set notify_events = false where user_id = auth.uid();
select pg_temp.check('Ester kan ändra sina notisval',
  (select not notify_events from public.household_members where user_id = auth.uid()));

do $$ begin
  insert into public.household_invites (household_id, code, created_by)
    values ('10000000-0000-0000-0000-000000000001', 'TEST-1234', auth.uid());
  raise exception 'FEL: medlem kunde skapa inbjudan';
exception when insufficient_privilege then raise notice 'OK: bara ägaren bjuder in';
end $$;

insert into public.schedules (household_id, dog_id, type, local_time, responsible_user_id, remind_minutes_before)
  values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'walk', '07:00', auth.uid(), 15);
do $$ begin
  insert into public.schedules (household_id, dog_id, type, local_time, responsible_user_id)
    values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'walk', '12:00', '00000000-0000-0000-0000-00000000000c');
  raise exception 'FEL: ansvarig utanför hushållet godtogs';
exception when insufficient_privilege then raise notice 'OK: ansvarig måste vara medlem';
end $$;

do $$ begin
  perform 1 from public.reminder_log;
  raise notice 'OK: reminder_log ger tomt resultat';
end $$;
select pg_temp.check('reminder_log osynlig för klienter', (select count(*) from public.reminder_log) = 0);

-- Annan familj (C)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check('C ser bara Fido', (select array_agg(name) from public.dogs) = '{Fido}');
select pg_temp.check('C ser inga händelser från A', (select count(*) from public.events) = 0);
select pg_temp.check('C ser inget schema från A', (select count(*) from public.schedules) = 0);
select pg_temp.check('C ser bara sin egen profil', (select count(*) from public.profiles) = 1);
select pg_temp.check('C ser bara sitt medlemskap', (select count(*) from public.household_members) = 1);

-- Sven (ägare A)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.household_invites (household_id, code, created_by)
  values ('10000000-0000-0000-0000-000000000001', 'TEST-1234', auth.uid());
select pg_temp.check('ägaren kan skapa inbjudan', (select count(*) from public.household_invites) = 1);
select pg_temp.check('Sven ser Esters händelse', (select count(*) from public.events) = 1);
delete from public.events;
select pg_temp.check('Sven kan inte ta bort Esters händelse', (select count(*) from public.events) = 1);

reset role;
\echo 'Alla RLS-tester gick igenom.'
