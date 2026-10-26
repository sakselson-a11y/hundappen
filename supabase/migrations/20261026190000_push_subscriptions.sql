-- Steg 6: spara enhetens pushprenumeration.
-- En enhet (endpoint) hör alltid till den som senast loggade in på den.

create function public.save_push_subscription(
  sub_endpoint text,
  sub_p256dh text,
  sub_auth text,
  sub_user_agent text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Inte inloggad' using errcode = '42501';
  end if;
  if sub_endpoint !~ '^https://' then
    raise exception 'Ogiltig endpoint' using errcode = '22023';
  end if;

  insert into public.profiles (id) values (uid) on conflict (id) do nothing;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    values (uid, sub_endpoint, sub_p256dh, sub_auth, left(sub_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        failure_count = 0;
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
