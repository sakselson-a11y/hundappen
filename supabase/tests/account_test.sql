-- Tester för ägarbyte och att lämna hushåll.
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
  ('00000000-0000-0000-0000-00000000000c', 'annan@example.com');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.create_household_with_dog('Tucci');
select public.create_invite((select id from public.households));
reset role;
insert into public.household_members (household_id, user_id)
  select id, '00000000-0000-0000-0000-00000000000b' from public.households;
set role authenticated;

-- Ägaren kan inte bara gå (hushållet skulle bli ägarlöst)
delete from public.household_members where user_id = auth.uid();
select pg_temp.check('ägaren kan inte ta bort sig själv direkt',
  (select count(*) from public.household_members where user_id = auth.uid()) = 1);

-- Ester (medlem) kan inte ta över
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  perform public.transfer_ownership('00000000-0000-0000-0000-00000000000b');
  raise exception 'FEL: medlem kunde göra sig till ägare';
exception when insufficient_privilege then raise notice 'OK: medlem kan inte byta ägare';
end $$;

-- Sven försöker ge ägarskapet till någon utanför
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  perform public.transfer_ownership('00000000-0000-0000-0000-00000000000c');
  raise exception 'FEL: ägarskap gavs till icke-medlem';
exception when raise_exception then raise notice 'OK: ny ägare måste vara medlem';
end $$;

select public.transfer_ownership('00000000-0000-0000-0000-00000000000b');
select pg_temp.check('Ester är ny ägare',
  (select role = 'owner' from public.household_members where user_id = '00000000-0000-0000-0000-00000000000b'));
select pg_temp.check('Sven är nu medlem',
  (select role = 'member' from public.household_members where user_id = '00000000-0000-0000-0000-00000000000a'));
reset role;
select pg_temp.check('gamla inbjudningar återkallade',
  (select count(*) from public.household_invites where revoked_at is null) = 0);
set role authenticated;

-- Sven lämnar (medlem tar bort sin egen rad)
delete from public.household_members where user_id = auth.uid();
select pg_temp.check('Sven har lämnat', (select count(*) from public.households) = 0);

-- Borttaget konto: loggar finns kvar som "tidigare medlem"
reset role;
insert into public.events (household_id, dog_id, type, logged_by)
  select household_id, id, 'walk', '00000000-0000-0000-0000-00000000000a' from public.dogs;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check('profil borttagen med kontot',
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 0);
select pg_temp.check('loggen finns kvar utan namn', (select logged_by is null from public.events));

-- Hushåll som tas bort tar med sig allt
delete from public.households;
select pg_temp.check('hund, loggar och medlemmar borttagna',
  (select count(*) from public.dogs) + (select count(*) from public.events) + (select count(*) from public.household_members) = 0);

\echo 'Alla kontotester gick igenom.'
