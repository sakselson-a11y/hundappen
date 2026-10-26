-- Hundappen: grundschema med Row Level Security.
-- Allt delat innehåll hör till ett hushåll; bara hushållets medlemmar kommer åt det.

-- ---------------------------------------------------------------------------
-- Typer
-- ---------------------------------------------------------------------------

create type public.event_type as enum ('walk', 'meal');
create type public.member_role as enum ('owner', 'member');
create type public.reminder_pref as enum ('all', 'mine', 'none');

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(trim(display_name)) between 1 and 40),
  locale       text not null default 'sv',
  time_zone    text not null default 'Europe/Stockholm',
  created_at   timestamptz not null default now()
);

create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(trim(name)) between 1 and 60),
  time_zone  text not null default 'Europe/Stockholm',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id     uuid not null references public.households (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  role             public.member_role not null default 'member',
  joined_at        timestamptz not null default now(),
  notify_events    boolean not null default true,
  notify_reminders public.reminder_pref not null default 'all',
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

create table public.household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code         text not null unique,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  max_uses     int not null default 10 check (max_uses > 0),
  use_count    int not null default 0,
  revoked_at   timestamptz
);
create index household_invites_household_idx on public.household_invites (household_id);

create table public.dogs (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 1 and 40),
  breed        text check (char_length(breed) <= 60),
  birth_date   date,
  photo_path   text,
  created_at   timestamptz not null default now(),
  archived_at  timestamptz,
  -- Gör det möjligt för andra tabeller att kräva att hunden tillhör samma hushåll.
  unique (id, household_id)
);
create index dogs_household_idx on public.dogs (household_id);

create table public.events (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  dog_id       uuid not null,
  type         public.event_type not null,
  occurred_at  timestamptz not null default now(),
  logged_by    uuid references public.profiles (id) on delete set null,
  pee          boolean,
  poop         boolean,
  note         text check (char_length(note) <= 500),
  created_at   timestamptz not null default now(),
  foreign key (dog_id, household_id) references public.dogs (id, household_id) on delete cascade
);
create index events_dog_type_time_idx on public.events (dog_id, type, occurred_at desc);
create index events_household_time_idx on public.events (household_id, occurred_at desc);

create table public.schedules (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null,
  dog_id                uuid not null,
  type                  public.event_type not null,
  local_time            time not null,
  -- ISO-veckodagar: 1 = måndag … 7 = söndag
  days_of_week          smallint[] not null default '{1,2,3,4,5,6,7}'
                        check (cardinality(days_of_week) > 0 and days_of_week <@ '{1,2,3,4,5,6,7}'),
  responsible_user_id   uuid references public.profiles (id) on delete set null,
  remind_minutes_before int check (remind_minutes_before between 0 and 240),
  skip_window_minutes   int not null default 60 check (skip_window_minutes between 0 and 720),
  active                boolean not null default true,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  foreign key (dog_id, household_id) references public.dogs (id, household_id) on delete cascade
);
create index schedules_household_idx on public.schedules (household_id);

create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count   int not null default 0
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Används bara av servern (påminnelser); ingen klientåtkomst.
create table public.reminder_log (
  schedule_id   uuid not null references public.schedules (id) on delete cascade,
  occurrence_at timestamptz not null,
  status        text not null check (status in ('sent', 'skipped')),
  processed_at  timestamptz not null default now(),
  primary key (schedule_id, occurrence_at)
);

-- ---------------------------------------------------------------------------
-- Hjälpfunktioner för RLS (security definer för att undvika rekursiva policyer)
-- ---------------------------------------------------------------------------

create function public.is_household_member(hid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = (select auth.uid())
  );
$$;

create function public.is_household_owner(hid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

-- Sant om den inloggade användaren och other_user delar minst ett hushåll.
create function public.shares_household_with(other_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members me
    join public.household_members them on them.household_id = me.household_id
    where me.user_id = (select auth.uid()) and them.user_id = other_user
  );
$$;

revoke execute on function public.is_household_member(uuid) from public, anon;
revoke execute on function public.is_household_owner(uuid) from public, anon;
revoke execute on function public.shares_household_with(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.shares_household_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Skapa profil automatiskt när en användare registreras
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles           enable row level security;
alter table public.households         enable row level security;
alter table public.household_members  enable row level security;
alter table public.household_invites  enable row level security;
alter table public.dogs               enable row level security;
alter table public.events             enable row level security;
alter table public.schedules          enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_log       enable row level security;

-- Utloggade användare (anon) ska inte kunna göra något alls.
revoke all on all tables in schema public from anon;

-- profiles: se sig själv och andra i samma hushåll, ändra bara sig själv.
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_household_with(id));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- households: skapas via databasfunktion (steg 3). Ägaren får byta namn/tidszon och ta bort.
create policy "households_select" on public.households for select to authenticated
  using (public.is_household_member(id));
create policy "households_update_owner" on public.households for update to authenticated
  using (public.is_household_owner(id)) with check (public.is_household_owner(id));
create policy "households_delete_owner" on public.households for delete to authenticated
  using (public.is_household_owner(id));

-- household_members: läggs till via databasfunktioner. Var och en får ändra sina
-- egna notisval (bara de kolumnerna, se grant nedan). Man får lämna själv, och
-- ägaren får ta bort andra.
create policy "members_select" on public.household_members for select to authenticated
  using (public.is_household_member(household_id));
create policy "members_update_own" on public.household_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "members_delete" on public.household_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_household_owner(household_id));
revoke update on public.household_members from authenticated;
grant update (notify_events, notify_reminders) on public.household_members to authenticated;

-- household_invites: ägaren skapar, ser och återkallar. Inlösen sker via databasfunktion.
create policy "invites_select_owner" on public.household_invites for select to authenticated
  using (public.is_household_owner(household_id));
create policy "invites_insert_owner" on public.household_invites for insert to authenticated
  with check (public.is_household_owner(household_id) and created_by = (select auth.uid()));
create policy "invites_update_owner" on public.household_invites for update to authenticated
  using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));
revoke update on public.household_invites from authenticated;
grant update (revoked_at) on public.household_invites to authenticated;

-- dogs: alla medlemmar ser, lägger till och redigerar. Bara ägaren tar bort.
create policy "dogs_select" on public.dogs for select to authenticated
  using (public.is_household_member(household_id));
create policy "dogs_insert" on public.dogs for insert to authenticated
  with check (public.is_household_member(household_id));
create policy "dogs_update" on public.dogs for update to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "dogs_delete_owner" on public.dogs for delete to authenticated
  using (public.is_household_owner(household_id));

-- events: alla medlemmar ser och loggar (alltid i eget namn). Man ändrar och tar bort sina egna.
create policy "events_select" on public.events for select to authenticated
  using (public.is_household_member(household_id));
create policy "events_insert" on public.events for insert to authenticated
  with check (public.is_household_member(household_id) and logged_by = (select auth.uid()));
create policy "events_update_own" on public.events for update to authenticated
  using (logged_by = (select auth.uid()) and public.is_household_member(household_id))
  with check (logged_by = (select auth.uid()) and public.is_household_member(household_id));
create policy "events_delete_own" on public.events for delete to authenticated
  using (logged_by = (select auth.uid()) and public.is_household_member(household_id));

-- schedules: alla medlemmar hanterar schemat. Ansvarig måste vara medlem i hushållet.
create policy "schedules_select" on public.schedules for select to authenticated
  using (public.is_household_member(household_id));
create policy "schedules_insert" on public.schedules for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and (responsible_user_id is null or exists (
      select 1 from public.household_members m
      where m.household_id = schedules.household_id and m.user_id = schedules.responsible_user_id))
  );
create policy "schedules_update" on public.schedules for update to authenticated
  using (public.is_household_member(household_id))
  with check (
    public.is_household_member(household_id)
    and (responsible_user_id is null or exists (
      select 1 from public.household_members m
      where m.household_id = schedules.household_id and m.user_id = schedules.responsible_user_id))
  );
create policy "schedules_delete" on public.schedules for delete to authenticated
  using (public.is_household_member(household_id));

-- push_subscriptions: bara ens egna enheter.
create policy "push_own" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- reminder_log: inga policyer, alltså ingen åtkomst för klienter.
