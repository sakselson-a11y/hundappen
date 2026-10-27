-- Kort rastning eller lång promenad, på loggar och i schemat.
-- Regel: en lång promenad räknas även för en schemalagd kort rastning, men inte tvärtom.
-- Äldre rastningar utan längd räknas som korta.

alter table public.events
  add column walk_length text check (walk_length in ('short', 'long')),
  add constraint events_walk_length_only_walks check (type = 'walk' or walk_length is null);

alter table public.schedules
  add column walk_length text check (walk_length in ('short', 'long')),
  add constraint schedules_walk_length_only_walks check (type = 'walk' or walk_length is null);

update public.schedules set walk_length = 'short' where type = 'walk';

-- Sant om loggen räknas för schemaraden.
create function public.event_satisfies(
  schedule_type public.event_type,
  schedule_length text,
  event_type public.event_type,
  event_length text
)
returns boolean
language sql immutable set search_path = ''
as $$
  select schedule_type = event_type
    and (schedule_type <> 'walk' or coalesce(schedule_length, 'short') = 'short' or event_length = 'long');
$$;

create or replace function public.due_reminders()
returns table (schedule_id uuid, occurrence_at timestamptz, skip boolean)
language sql stable security definer set search_path = ''
as $$
  with candidates as (
    select
      s.id,
      s.dog_id,
      s.type,
      s.walk_length,
      s.skip_window_minutes,
      s.remind_minutes_before,
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
        and public.event_satisfies(c.type, c.walk_length, e.type, e.walk_length)
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

-- Returtypen ändras (walk_length tillkommer), så funktionen måste skapas om.
drop function public.claim_due_reminders();
create function public.claim_due_reminders()
returns table (
  schedule_id uuid,
  occurrence_at timestamptz,
  household_id uuid,
  dog_name text,
  type public.event_type,
  walk_length text,
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
    s.walk_length,
    s.responsible_user_id,
    p.display_name,
    s.remind_minutes_before
  from logged l
  join public.schedules s on s.id = l.schedule_id
  join public.dogs dg on dg.id = s.dog_id
  left join public.profiles p on p.id = s.responsible_user_id
  where l.status = 'sent';
$$;

revoke execute on function public.claim_due_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_reminders() to service_role;
