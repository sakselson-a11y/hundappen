-- Steg 5: valfritt foto på loggar och realtidsuppdateringar.

-- Sökväg i dog-photos: <household_id>/events/<event_id>.jpg (skyddas av befintliga storage-policyer).
alter table public.events add column photo_path text;

-- Skicka ändringar i events till inloggade medlemmar i realtid (RLS gäller även här).
alter publication supabase_realtime add table public.events;
