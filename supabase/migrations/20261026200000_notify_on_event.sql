-- Steg 7: notis till övriga i hushållet när någon loggar.
-- Databasen anropar Edge Function notify-event efter varje ny logg (via pg_net, asynkront).
-- Funktionen markerar loggen som notifierad, så varje logg ger högst en notis.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
end $$;

alter table public.events add column notified_at timestamptz;

create function public.notify_event_inserted()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://glkphbxspzhwhdveiori.supabase.co/functions/v1/notify-event',
    body := jsonb_build_object('event_id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- En notis får aldrig hindra att loggen sparas.
  raise warning 'notify-event kunde inte anropas: %', sqlerrm;
  return new;
end;
$$;

create trigger events_notify_after_insert
  after insert on public.events
  for each row execute function public.notify_event_inserted();
