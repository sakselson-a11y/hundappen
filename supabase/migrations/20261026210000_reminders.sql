-- Steg 9: påminnelser via pg_cron.
-- Varje minut: finns det påminnelser att hantera anropas Edge Function send-reminders,
-- som hämtar dem med claim_due_reminders() och skickar notiser.

-- Schemalagda tillfällen vars påminnelsetid har inträffat (senaste 10 min) och som inte hanterats.
-- skip = någon har redan loggat samma sak inom fönstret, så ingen påminnelse ska skickas.
create function public.due_reminders()
returns table (schedule_id uuid, occurrence_at timestamptz, skip boolean)
language sql stable security definer set search_path = ''
as $$
  with candidates as (
    select
      s.id,
      s.dog_id,
      s.type,
      s.skip_window_minutes,
      s.remind_minutes_before,
      -- Schemats klockslag tolkas i hushållets tidszon (klarar sommartid).
      ((d.day + s.local_time) at time zone h.time_zone) as occ
    from public.schedules s
    join public.households h on h.id = s.household_id
    cross join lateral (
      select (now() at time zone h.time_zone)::date + o as day from generate_series(-1, 1) o
    ) d
    where s.active
      and s.remind_minutes_before is not null
      and extract(isodow from d.day)::int = any (s.days_of_week)
  )
  select
    c.id,
    c.occ,
    exists (
      select 1 from public.events e
      where e.dog_id = c.dog_id
        and e.type = c.type
        and e.occurred_at >= c.occ - make_interval(mins => c.skip_window_minutes)
        and e.occurred_at <= now()
    )
  from candidates c
  where c.occ - make_interval(mins => c.remind_minutes_before) <= now()
    and c.occ - make_interval(mins => c.remind_minutes_before) > now() - interval '10 minutes'
    and not exists (
      select 1 from public.reminder_log l where l.schedule_id = c.id and l.occurrence_at = c.occ
    );
$$;

-- Markerar tillfällena som hanterade (en gång) och returnerar de påminnelser som ska skickas.
create function public.claim_due_reminders()
returns table (
  schedule_id uuid,
  occurrence_at timestamptz,
  household_id uuid,
  dog_name text,
  type public.event_type,
  responsible_user_id uuid,
  responsible_name text,
  minutes_before int
)
language sql volatile security definer set search_path = ''
as $$
  with due as (
    select * from public.due_reminders()
  ),
  logged as (
    insert into public.reminder_log (schedule_id, occurrence_at, status)
      select d.schedule_id, d.occurrence_at, case when d.skip then 'skipped' else 'sent' end from due d
    on conflict do nothing
    returning reminder_log.schedule_id, reminder_log.occurrence_at, reminder_log.status
  )
  select
    s.id,
    l.occurrence_at,
    s.household_id,
    dg.name,
    s.type,
    s.responsible_user_id,
    p.display_name,
    s.remind_minutes_before
  from logged l
  join public.schedules s on s.id = l.schedule_id
  join public.dogs dg on dg.id = s.dog_id
  left join public.profiles p on p.id = s.responsible_user_id
  where l.status = 'sent';
$$;

revoke execute on function public.due_reminders() from public, anon, authenticated;
revoke execute on function public.claim_due_reminders() from public, anon, authenticated;
grant execute on function public.due_reminders() to service_role;
grant execute on function public.claim_due_reminders() to service_role;

-- Anropar send-reminders, men bara när det finns något att göra.
create function public.trigger_reminders()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.due_reminders()) then
    perform net.http_post(
      url := 'https://glkphbxspzhwhdveiori.supabase.co/functions/v1/send-reminders',
      body := '{}'::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 10000
    );
  end if;
end;
$$;

revoke execute on function public.trigger_reminders() from public, anon, authenticated;

-- Rensa gamla rader i reminder_log (behövs bara några dygn).
create function public.cleanup_reminder_log()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.reminder_log where occurrence_at < now() - interval '7 days';
$$;

revoke execute on function public.cleanup_reminder_log() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('send-reminders', '* * * * *', 'select public.trigger_reminders()');
    perform cron.schedule('cleanup-reminder-log', '17 3 * * *', 'select public.cleanup_reminder_log()');
  end if;
end $$;
