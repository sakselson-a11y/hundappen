-- Byt tur för ett tillfälle, och tillfälligt medlemskap för hundvakt.

-- ===========================================================================
-- Hundvakt: medlemskap med slutdatum
-- ===========================================================================

alter table public.household_members add column expires_at timestamptz;
alter table public.household_invites add column guest_days int check (guest_days between 1 and 60);

-- Ett utgånget medlemskap räknas inte (ingen åtkomst, inga notiser).
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = (select auth.uid())
      and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.shares_household_with(other_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members me
    join public.household_members them on them.household_id = me.household_id
    where me.user_id = (select auth.uid()) and them.user_id = other_user
      and (me.expires_at is null or me.expires_at > now())
  );
$$;

-- Inbjudan: vanlig (guest_days null) eller hundvakt (antal dagar). En ny kod återkallar
-- bara tidigare koder av samma sort.
drop function public.create_invite(uuid);
create function public.create_invite(hid uuid, invite_guest_days int default null)
returns public.household_invites
language plpgsql security definer set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea;
  new_code text;
  invite public.household_invites;
begin
  if not public.is_household_owner(hid) then
    raise exception 'Bara ägaren kan bjuda in' using errcode = '42501';
  end if;

  update public.household_invites
    set revoked_at = now()
    where household_id = hid and revoked_at is null
      and (guest_days is null) = (invite_guest_days is null);

  loop
    bytes := uuid_send(gen_random_uuid());
    new_code := '';
    for i in 0..7 loop
      new_code := new_code || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
    end loop;
    begin
      insert into public.household_invites (household_id, code, created_by, guest_days)
        values (hid, new_code, auth.uid(), invite_guest_days)
        returning * into invite;
      return invite;
    exception when unique_violation then
    end;
  end loop;
end;
$$;

revoke execute on function public.create_invite(uuid, int) from public, anon;
grant execute on function public.create_invite(uuid, int) to authenticated;

drop function public.invite_preview(text);
create function public.invite_preview(invite_code text)
returns table (dog_name text, inviter_name text, guest_days int)
language sql stable security definer set search_path = ''
as $$
  select
    (select d.name from public.dogs d
      where d.household_id = i.household_id and d.archived_at is null
      order by d.created_at limit 1),
    (select p.display_name from public.profiles p where p.id = i.created_by),
    i.guest_days
  from public.household_invites i
  where i.code = public.normalize_invite_code(invite_code)
    and i.revoked_at is null
    and i.expires_at > now()
    and i.use_count < i.max_uses;
$$;

revoke execute on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;

create or replace function public.join_household(invite_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  invite public.household_invites;
  new_expiry timestamptz;
  existing public.household_members;
begin
  if uid is null then
    raise exception 'Inte inloggad' using errcode = '42501';
  end if;

  select * into invite
    from public.household_invites
    where code = public.normalize_invite_code(invite_code)
      and revoked_at is null
      and expires_at > now()
      and use_count < max_uses
    for update;

  if not found then
    raise exception 'invalid_invite' using errcode = 'P0001';
  end if;

  new_expiry := case when invite.guest_days is null then null
                     else now() + make_interval(days => invite.guest_days) end;

  -- Gamla, utgångna hundvaktsuppdrag räknas inte.
  delete from public.household_members where user_id = uid and expires_at <= now();

  select * into existing from public.household_members
    where household_id = invite.household_id and user_id = uid;
  if found then
    -- Redan med: en vanlig inbjudan gör medlemskapet permanent, en hundvaktsinbjudan förlänger.
    if existing.expires_at is not null then
      update public.household_members
        set expires_at = case when new_expiry is null then null else greatest(existing.expires_at, new_expiry) end
        where household_id = invite.household_id and user_id = uid;
    end if;
    return invite.household_id;
  end if;

  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'already_in_household' using errcode = 'P0001';
  end if;

  insert into public.profiles (id) values (uid) on conflict (id) do nothing;
  insert into public.household_members (household_id, user_id, role, expires_at)
    values (invite.household_id, uid, 'member', new_expiry);
  update public.household_invites set use_count = use_count + 1 where id = invite.id;

  return invite.household_id;
end;
$$;

-- En hundvakt kan inte bli ägare.
create or replace function public.transfer_ownership(new_owner uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  select household_id into hid
    from public.household_members
    where user_id = uid and role = 'owner';
  if hid is null then
    raise exception 'Bara ägaren kan byta ägare' using errcode = '42501';
  end if;
  if new_owner = uid then
    return;
  end if;
  if not exists (select 1 from public.household_members
                 where household_id = hid and user_id = new_owner and expires_at is null) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;

  update public.household_members set role = 'owner' where household_id = hid and user_id = new_owner;
  update public.household_members set role = 'member' where household_id = hid and user_id = uid;
  update public.household_invites set revoked_at = now() where household_id = hid and revoked_at is null;
end;
$$;

-- Nattlig städning av utgångna hundvaktsmedlemskap.
create function public.cleanup_expired_members()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.household_members where expires_at <= now();
$$;

revoke execute on function public.cleanup_expired_members() from public, anon, authenticated;

-- ===========================================================================
-- Byt tur: undantag för en schemarad en viss dag (i hushållets tidszon)
-- ===========================================================================

create table public.schedule_overrides (
  schedule_id         uuid not null references public.schedules (id) on delete cascade,
  occurrence_date     date not null,
  household_id        uuid not null references public.households (id) on delete cascade,
  -- null = "ingen särskild" just den dagen
  responsible_user_id uuid references public.profiles (id) on delete set null,
  changed_by          uuid references public.profiles (id) on delete set null,
  updated_at          timestamptz not null default now(),
  notified_at         timestamptz,
  primary key (schedule_id, occurrence_date)
);
create index schedule_overrides_household_idx on public.schedule_overrides (household_id, occurrence_date);

alter table public.schedule_overrides enable row level security;

create policy "overrides_select" on public.schedule_overrides for select to authenticated
  using (public.is_household_member(household_id));

-- Schemaraden måste höra till hushållet, och den som tar turen måste vara medlem.
create policy "overrides_insert" on public.schedule_overrides for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and changed_by = (select auth.uid())
    and exists (select 1 from public.schedules s where s.id = schedule_id and s.household_id = schedule_overrides.household_id)
    and (responsible_user_id is null or exists (
      select 1 from public.household_members m
      where m.household_id = schedule_overrides.household_id and m.user_id = schedule_overrides.responsible_user_id))
  );
create policy "overrides_update" on public.schedule_overrides for update to authenticated
  using (public.is_household_member(household_id))
  with check (
    public.is_household_member(household_id)
    and changed_by = (select auth.uid())
    and exists (select 1 from public.schedules s where s.id = schedule_id and s.household_id = schedule_overrides.household_id)
    and (responsible_user_id is null or exists (
      select 1 from public.household_members m
      where m.household_id = schedule_overrides.household_id and m.user_id = schedule_overrides.responsible_user_id))
  );
create policy "overrides_delete" on public.schedule_overrides for delete to authenticated
  using (public.is_household_member(household_id));

revoke update on public.schedule_overrides from authenticated;
-- Allt utom notified_at (som bara servern sätter). Appen sparar med upsert.
grant update (schedule_id, occurrence_date, household_id, responsible_user_id, changed_by, updated_at)
  on public.schedule_overrides to authenticated;

create function public.touch_schedule_override()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger schedule_overrides_touch
  before update on public.schedule_overrides
  for each row execute function public.touch_schedule_override();

-- Meddela familjen när någon byter tur (Edge Function notify-swap).
create function public.notify_swap()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://glkphbxspzhwhdveiori.supabase.co/functions/v1/notify-swap',
    body := jsonb_build_object('schedule_id', new.schedule_id, 'occurrence_date', new.occurrence_date),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  raise warning 'notify-swap kunde inte anropas: %', sqlerrm;
  return new;
end;
$$;

create trigger schedule_overrides_notify
  after insert or update on public.schedule_overrides
  for each row execute function public.notify_swap();

-- Påminnelser går till den som har turen just den dagen.
create or replace function public.claim_due_reminders()
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
  ),
  resolved as (
    select
      l.schedule_id,
      l.occurrence_at,
      case when o.schedule_id is not null then o.responsible_user_id else s.responsible_user_id end as responsible
    from logged l
    join public.schedules s on s.id = l.schedule_id
    join public.households h on h.id = s.household_id
    left join public.schedule_overrides o
      on o.schedule_id = s.id and o.occurrence_date = (l.occurrence_at at time zone h.time_zone)::date
    where l.status = 'sent'
  )
  select
    s.id,
    r.occurrence_at,
    s.household_id,
    dg.name,
    s.type,
    s.walk_length,
    r.responsible,
    p.display_name,
    s.remind_minutes_before
  from resolved r
  join public.schedules s on s.id = r.schedule_id
  join public.dogs dg on dg.id = s.dog_id
  left join public.profiles p on p.id = r.responsible;
$$;

-- Städa undantag som passerat (behövs inte efter en vecka).
create function public.cleanup_schedule_overrides()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.schedule_overrides where occurrence_date < current_date - 7;
$$;

revoke execute on function public.cleanup_schedule_overrides() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('cleanup-expired-members', '23 3 * * *', 'select public.cleanup_expired_members()');
    perform cron.schedule('cleanup-schedule-overrides', '29 3 * * *', 'select public.cleanup_schedule_overrides()');
  end if;
end $$;
