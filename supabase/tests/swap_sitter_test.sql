-- Tester för byt tur och hundvakt.
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
  ('00000000-0000-0000-0000-0000000000f1', 'vakt@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'annan@example.com');
update public.profiles set display_name = 'Sven' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set display_name = 'Ester' where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set display_name = 'Vakten' where id = '00000000-0000-0000-0000-0000000000f1';

create temp table codes (label text, code text);
grant all on codes to anon, authenticated;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.create_household_with_dog('Tucci', null, null, 'Europe/Stockholm');
insert into codes select 'family', code from public.create_invite((select id from public.households));
insert into codes select 'sitter', code from public.create_invite((select id from public.households), 7);
select pg_temp.check('vanlig kod och hundvaktskod kan finnas samtidigt',
  (select count(*) from public.household_invites where revoked_at is null) = 2);
insert into codes select 'sitter2', code from public.create_invite((select id from public.households), 3);
select pg_temp.check('ny hundvaktskod återkallar bara gamla hundvaktskoden',
  (select count(*) from public.household_invites where revoked_at is null and guest_days is null) = 1
  and (select count(*) from public.household_invites where revoked_at is null and guest_days = 3) = 1);

-- Förhandsvisning visar hundvakt
reset role;
set role anon;
select pg_temp.check('förhandsvisning visar antal dagar',
  (select guest_days = 3 from public.invite_preview((select code from codes where label = 'sitter2'))));
reset role;

-- Ester går med som familj, Vakten som hundvakt
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.join_household((select code from codes where label = 'family'));
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select public.join_household((select code from codes where label = 'sitter2'));
select pg_temp.check('hundvakten ser Tucci', (select count(*) from public.dogs) = 1);
select pg_temp.check('hundvaktens medlemskap går ut om 3 dagar',
  (select abs(extract(epoch from expires_at - (now() + interval '3 days'))) < 5
   from public.household_members where user_id = auth.uid()));
do $$ begin
  perform public.create_invite((select id from public.households));
  raise exception 'FEL: hundvakt kunde bjuda in';
exception when insufficient_privilege then raise notice 'OK: hundvakten kan inte bjuda in';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  perform public.transfer_ownership('00000000-0000-0000-0000-0000000000f1');
  raise exception 'FEL: hundvakt blev ägare';
exception when raise_exception then raise notice 'OK: hundvakt kan inte bli ägare';
end $$;

-- Byt tur
reset role;
create temp table t as select
  (select id from public.households) hid,
  (select id from public.dogs) did,
  ((now() at time zone 'Europe/Stockholm') + interval '15 minutes')::time as in15,
  ((now() at time zone 'Europe/Stockholm') + interval '15 minutes')::date as occ_date;
grant select on t to authenticated;
insert into public.schedules (id, household_id, dog_id, type, walk_length, local_time, responsible_user_id, remind_minutes_before)
  select '30000000-0000-0000-0000-000000000001', hid, did, 'walk', 'long', in15, '00000000-0000-0000-0000-00000000000b', 15 from t;
delete from net.calls;
set role authenticated;

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
insert into public.schedule_overrides (schedule_id, occurrence_date, household_id, responsible_user_id, changed_by)
  select '30000000-0000-0000-0000-000000000001', occ_date, hid, auth.uid(), auth.uid() from t;
select pg_temp.check('hundvakten tar turen', (select count(*) from public.schedule_overrides) = 1);
reset role;
select pg_temp.check('bytet meddelas via notify-swap',
  (select count(*) from net.calls where url like '%/functions/v1/notify-swap') = 1);
create temp table claimed as select * from public.claim_due_reminders();
select pg_temp.check('påminnelsen går till den som tagit turen',
  (select responsible_name = 'Vakten' from claimed));
set role authenticated;

-- Någon annan familj får inte ändra
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  insert into public.schedule_overrides (schedule_id, occurrence_date, household_id, responsible_user_id, changed_by)
    select '30000000-0000-0000-0000-000000000001', occ_date + 1, hid, auth.uid(), auth.uid() from t;
  raise exception 'FEL: annan familj kunde byta tur';
exception when insufficient_privilege then raise notice 'OK: annan familj kan inte byta tur';
end $$;

-- Ester kan inte ge turen till någon utanför familjen
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  update public.schedule_overrides set responsible_user_id = '00000000-0000-0000-0000-00000000000c', changed_by = auth.uid();
  raise exception 'FEL: turen gavs till icke-medlem';
exception when insufficient_privilege then raise notice 'OK: turen kan bara ges till medlem';
end $$;

-- Ester tar tillbaka turen (upsert) → ny notis
insert into public.schedule_overrides (schedule_id, occurrence_date, household_id, responsible_user_id, changed_by)
  select '30000000-0000-0000-0000-000000000001', occ_date, hid, auth.uid(), auth.uid() from t
on conflict (schedule_id, occurrence_date) do update
  set responsible_user_id = excluded.responsible_user_id, changed_by = excluded.changed_by;
reset role;
select pg_temp.check('ny ändring meddelas igen', (select count(*) from net.calls where url like '%notify-swap') = 2);
set role authenticated;

-- Hundvakten när tiden gått ut
reset role;
update public.household_members set expires_at = now() - interval '1 minute' where user_id = '00000000-0000-0000-0000-0000000000f1';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.check('utgången hundvakt ser ingenting',
  (select count(*) from public.dogs) + (select count(*) from public.households) + (select count(*) from public.events) = 0);
-- Kan få ett nytt uppdrag
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into codes select 'sitter3', code from public.create_invite((select id from public.households), 2);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select public.join_household((select code from codes where label = 'sitter3'));
select pg_temp.check('nytt hundvaktsuppdrag efter utgånget', (select count(*) from public.dogs) = 1);
reset role;
update public.household_members set expires_at = now() - interval '1 minute' where user_id = '00000000-0000-0000-0000-0000000000f1';
select public.cleanup_expired_members();
select pg_temp.check('städningen tar bort utgångna', (select count(*) from public.household_members where expires_at is not null) = 0);

\echo 'Alla tester för byt tur och hundvakt gick igenom.'
