# Hundappen – plan och datamodell (godkänd 2026-10-26)

## Beslut
- Inloggning: e-post med 6-siffrig kod (länken öppnas i Safari, inte i den installerade appen på iOS).
- Inbjudan: länk + kort kod som kan skrivas in i appen.
- Schematider sparas som lokal tid + hushållets tidszon (klarar sommartid). Händelser sparas i UTC.
- Vems tur: fast person per schemarad med valda veckodagar.
- Påminnelser: alla får dem som standard, var och en kan välja "bara min tur" eller "inga".
- Påminnelse hoppas över om samma typ loggats inom 60 min före schemalagd tid (ändringsbart per rad).

## Datamodell
- profiles: id, display_name, locale, time_zone, created_at
- households: id, name, time_zone, created_by, created_at
- household_members: household_id, user_id, role (owner|member), joined_at, notify_events, notify_reminders (all|mine|none)
- household_invites: id, household_id, code, created_by, expires_at, max_uses, use_count, revoked_at
- dogs: id, household_id, name, breed, birth_date, photo_path, created_at, archived_at
- events: id, household_id, dog_id, type (walk|meal), occurred_at, logged_by, pee, poop, note, photo_path (valfritt foto, tillägg 2026-10-26), created_at
- schedules: id, household_id, dog_id, type, local_time, days_of_week, responsible_user_id, remind_minutes_before, skip_window_minutes, active, created_by
- push_subscriptions: id, user_id, endpoint, p256dh, auth, user_agent, created_at, last_success_at, failure_count
- reminder_log: schedule_id, occurrence_at, status (sent|skipped), processed_at

## Steg
0. GitHub-repo + Supabase-projekt
1. Grundapp, PWA, i18n, publicering till GitHub Pages
2. Databas + RLS, inloggning med kod, namn
3. Skapa hund/hushåll med foto
4. Inbjudningar
5. Loggning (med valfritt foto vid rastning), översikt, historik (realtid)
6. Hemskärmsguide, notistillstånd, VAPID, testnotis
7. Notis vid loggning
8. Schema
9. Påminnelser via pg_cron
10. Lämna hushåll, radera konto, integritetstext

## Påminnelser (steg 9)
- pg_cron kör `trigger_reminders()` varje minut; den anropar Edge Function `send-reminders` bara när något väntar.
- `claim_due_reminders()` lämnar ut varje tillfälle en gång (reminder_log) och hoppar över om samma typ loggats inom fönstret.
- "Bara min tur": en tid utan ansvarig räknas som allas tur.

## Konto och integritet (steg 10)
- Medlem kan lämna. Ägare måste först göra någon annan till ägare (`transfer_ownership`), om inte hushållet är tomt.
- Edge Function `account`: `leave` (ensam ägare → hushållet och foton tas bort) och `delete` (konto bort; ägare med andra medlemmar → den som gick med först blir ägare).
- Loggar från borttagna konton finns kvar som "Tidigare medlem".
- Integritetstext i appen (Integritet-länk på inloggningen och under Familjen → Konto).

## Utseende
- Gul (#FFC81E) och svart (#141414) på varmt papper, tydliga kanter och "tryckta" skuggor.
- Rubriktypsnitt Bricolage Grotesque (SIL OFL), lokalt i src/assets/fonts.
