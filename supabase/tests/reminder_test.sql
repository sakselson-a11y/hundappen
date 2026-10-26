-- Tester för påminnelser. Tiderna räknas från nu, i Stockholmstid.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

create function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FEL: %', label; end if;
  raise notice 'OK: %', label;
end $$;

select pg_temp.check('cron-jobb schemalagt varje minut',
  (select schedule = '* * * * *' and command like '%trigger_reminders%' from cron.jobs where name = 'send-reminders'));

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'sven@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'ester@example.com');
update public.profiles set display_name = 'Ester' where id = '00000000-0000-0000-0000-00000000000b';

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.create_household_with_dog('Tucci', null, null, 'Europe/Stockholm');
reset role;
insert into public.household_members (household_id, user_id)
  select id, '00000000-0000-0000-0000-00000000000b' from public.households;

-- Om 15 minuter (lokal tid), påminnelse 15 min innan → ska påminnas nu.
create temp table t as select
  (select id from public.households) hid,
  (select id from public.dogs) did,
  ((now() at time zone 'Europe/Stockholm') + interval '15 minutes')::time as in15,
  extract(isodow from (now() at time zone 'Europe/Stockholm') + interval '15 minutes')::int as dow;

insert into public.schedules (id, household_id, dog_id, type, local_time, days_of_week, responsible_user_id, remind_minutes_before)
  select '30000000-0000-0000-0000-000000000001', hid, did, 'walk', in15, '{1,2,3,4,5,6,7}', '00000000-0000-0000-0000-00000000000b', 15 from t;
-- Samma tid men utan påminnelse, pausad, respektive annan veckodag → ska inte påminnas.
insert into public.schedules (household_id, dog_id, type, local_time, remind_minutes_before)
  select hid, did, 'walk', in15, null from t;
insert into public.schedules (household_id, dog_id, type, local_time, remind_minutes_before, active)
  select hid, did, 'walk', in15, 15, false from t;
insert into public.schedules (household_id, dog_id, type, local_time, remind_minutes_before, days_of_week)
  select hid, did, 'walk', in15, 15, array[((dow + 2) % 7) + 1] from t;
-- Påminnelsetiden har inte kommit än (30 min innan en tid om 45 min = om 15 min).
insert into public.schedules (household_id, dog_id, type, local_time, remind_minutes_before)
  select hid, did, 'meal', in15 + interval '45 minutes', 15 from t;

select pg_temp.check('bara rätt schema är aktuellt', (select count(*) from public.due_reminders()) = 1);

set role authenticated;
do $$ begin
  perform public.claim_due_reminders();
  raise exception 'FEL: inloggad användare kunde hämta påminnelser';
exception when insufficient_privilege then raise notice 'OK: klienter kan inte hämta påminnelser';
end $$;
reset role;

create temp table claimed as select * from public.claim_due_reminders();
select pg_temp.check('påminnelse hämtas med hund och ansvarig',
  (select count(*) = 1 and bool_and(dog_name = 'Tucci' and responsible_name = 'Ester' and minutes_before = 15 and type = 'walk') from claimed));
select pg_temp.check('tillfället ligger 15 min fram',
  (select abs(extract(epoch from occurrence_at - (now() + interval '15 minutes'))) < 1 from claimed));
select pg_temp.check('andra hämtningen ger inget (en gång per tillfälle)', (select count(*) from public.claim_due_reminders()) = 0);
select pg_temp.check('loggad som skickad', (select status = 'sent' from public.reminder_log));

-- Med en rastning nyss ska påminnelsen hoppas över.
delete from public.reminder_log;
insert into public.events (household_id, dog_id, type, logged_by, occurred_at)
  select hid, did, 'walk', '00000000-0000-0000-0000-00000000000b', now() - interval '20 minutes' from t;
select pg_temp.check('rastning nyss: ingen påminnelse', (select count(*) from public.claim_due_reminders()) = 0);
select pg_temp.check('loggad som överhoppad', (select status = 'skipped' from public.reminder_log));

-- Mat räknas inte som rastning.
delete from public.reminder_log;
delete from public.events;
insert into public.events (household_id, dog_id, type, logged_by, occurred_at)
  select hid, did, 'meal', '00000000-0000-0000-0000-00000000000b', now() - interval '5 minutes' from t;
select pg_temp.check('mat stoppar inte rastningspåminnelse', (select count(*) from public.claim_due_reminders()) = 1);

-- För gammal rastning (utanför 60-minutersfönstret före tillfället) räknas inte.
delete from public.reminder_log;
delete from public.events;
insert into public.events (household_id, dog_id, type, logged_by, occurred_at)
  select hid, did, 'walk', '00000000-0000-0000-0000-00000000000b', now() - interval '50 minutes' from t;
select pg_temp.check('rastning för länge sedan stoppar inte', (select count(*) from public.claim_due_reminders()) = 1);

-- trigger_reminders anropar funktionen bara när något väntar.
delete from net.calls;
select public.trigger_reminders();
select pg_temp.check('inget väntar: inget anrop', (select count(*) from net.calls) = 0);
delete from public.reminder_log;
select public.trigger_reminders();
select pg_temp.check('något väntar: send-reminders anropas',
  (select count(*) from net.calls where url like '%/functions/v1/send-reminders') = 1);

\echo 'Alla påminnelsetester gick igenom.'
