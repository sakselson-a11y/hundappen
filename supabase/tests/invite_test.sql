-- Tester för inbjudningar.
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
  ('00000000-0000-0000-0000-00000000000c', 'annan@example.com'),
  ('00000000-0000-0000-0000-00000000000e', 'efter@example.com');
update public.profiles set display_name = 'Sven' where id = '00000000-0000-0000-0000-00000000000a';

create temp table codes (label text, code text);
grant all on codes to anon, authenticated;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.create_household_with_dog('Tucci');
insert into codes select 'first', code from public.create_invite((select id from public.households));
select pg_temp.check('koden har 8 tecken utan förväxlingsbara tecken',
  (select code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$' from codes where label = 'first'));
insert into codes select 'second', code from public.create_invite((select id from public.households));
select pg_temp.check('ny kod återkallar den gamla',
  (select count(*) from public.household_invites where revoked_at is null) = 1);

-- Förhandsvisning utan inloggning, med bindestreck och gemener
reset role;
set role anon;
select pg_temp.check('förhandsvisning visar hund och inbjudare',
  (select dog_name = 'Tucci' and inviter_name = 'Sven'
   from public.invite_preview((select lower(substr(code,1,4) || '-' || substr(code,5)) from codes where label = 'second'))));
select pg_temp.check('återkallad kod ger ingen förhandsvisning',
  (select count(*) from public.invite_preview((select code from codes where label = 'first'))) = 0);
do $$ begin
  perform public.join_household('XXXX');
  raise exception 'FEL: anon kunde gå med';
exception when insufficient_privilege then raise notice 'OK: anon kan inte gå med';
end $$;

-- Ester går med
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  perform public.join_household((select code from codes where label = 'first'));
  raise exception 'FEL: återkallad kod fungerade';
exception when raise_exception then raise notice 'OK: återkallad kod fungerar inte';
end $$;
select public.join_household(' ' || (select lower(code) from codes where label = 'second') || ' ');
select pg_temp.check('Ester är medlem', (select role = 'member' from public.household_members where user_id = auth.uid()));
select pg_temp.check('Ester ser Tucci', (select count(*) from public.dogs) = 1);
select pg_temp.check('Ester ser två medlemmar med namn',
  (select count(*) from public.household_members m join public.profiles p on p.id = m.user_id) = 2);
select public.join_household((select code from codes where label = 'second'));
select pg_temp.check('gå med två gånger ger ingen dubblett', (select count(*) from public.household_members) = 2);
do $$ begin
  perform public.create_invite((select id from public.households));
  raise exception 'FEL: medlem kunde skapa kod';
exception when insufficient_privilege then raise notice 'OK: medlem kan inte skapa kod';
end $$;

-- Någon som redan har ett eget hushåll
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select public.create_household_with_dog('Fido');
do $$ begin
  perform public.join_household((select code from codes where label = 'second'));
  raise exception 'FEL: kunde gå med i ett andra hushåll';
exception when raise_exception then raise notice 'OK: ett hushåll per användare';
end $$;

-- Utgången och förbrukad kod
reset role;
update public.household_invites set expires_at = now() - interval '1 minute';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
do $$ begin
  perform public.join_household((select code from codes where label = 'second'));
  raise exception 'FEL: utgången kod fungerade';
exception when raise_exception then raise notice 'OK: utgången kod fungerar inte';
end $$;
reset role;
update public.household_invites set expires_at = now() + interval '1 day', use_count = max_uses;
set role authenticated;
do $$ begin
  perform public.join_household((select code from codes where label = 'second'));
  raise exception 'FEL: förbrukad kod fungerade';
exception when raise_exception then raise notice 'OK: förbrukad kod fungerar inte';
end $$;

-- Ägaren tar bort Ester
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
delete from public.household_members where user_id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check('ägaren kan ta bort medlem', (select count(*) from public.household_members) = 1);

reset role;
\echo 'Alla inbjudningstester gick igenom.'
