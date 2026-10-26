-- Tester för pushprenumerationer.
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
  ('00000000-0000-0000-0000-00000000000b', 'ester@example.com');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.save_push_subscription('https://web.push.apple.com/abc', 'p1', 'a1', 'iPhone');
select public.save_push_subscription('https://web.push.apple.com/abc', 'p2', 'a2', 'iPhone');
select pg_temp.check('samma enhet sparas en gång', (select count(*) from public.push_subscriptions) = 1);
select pg_temp.check('nycklar uppdateras', (select p256dh = 'p2' from public.push_subscriptions));

do $$ begin
  perform public.save_push_subscription('http://evil.example/x', 'p', 'a');
  raise exception 'FEL: http-adress godtogs';
exception when invalid_parameter_value then raise notice 'OK: bara https godtas';
end $$;

-- Ester loggar in på samma telefon
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.save_push_subscription('https://web.push.apple.com/abc', 'p3', 'a3', 'iPhone');
select pg_temp.check('enheten flyttas till Ester', (select count(*) from public.push_subscriptions) = 1);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check('Sven ser inte längre enheten', (select count(*) from public.push_subscriptions) = 0);

reset role;
\echo 'Alla pushtester gick igenom.'
