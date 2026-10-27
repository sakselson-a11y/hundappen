// Anropas av databasen när en logg sparats. Skickar notis till övriga i hushållet.
// Kräver ingen inloggning: funktionen gör bara något för nya, ännu inte notifierade loggar.
import { adminClient, corsHeaders, json } from '../_shared/supabase.ts'
import { sendPush, type PushSubscriptionRow } from '../_shared/push.ts'
import { eventMessage } from '../_shared/messages.ts'
import { activeMembersFilter } from '../_shared/members.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const { event_id } = await req.json().catch(() => ({}))
  if (typeof event_id !== 'string') return json({ error: 'event_id saknas' }, 400)

  const admin = adminClient()

  // Markera som notifierad i samma steg som vi hämtar den, så att den bara skickas en gång.
  const { data: event, error } = await admin
    .from('events')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', event_id)
    .is('notified_at', null)
    .gt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .select('id, household_id, dog_id, type, walk_length, occurred_at, created_at, logged_by, pee, poop, note, photo_path')
    .maybeSingle()
  if (error) return json({ error: 'db' }, 500)
  if (!event) return json({ skipped: true })

  const [{ data: dog }, { data: household }, { data: logger }, { data: members }] = await Promise.all([
    admin.from('dogs').select('name').eq('id', event.dog_id).single(),
    admin.from('households').select('time_zone').eq('id', event.household_id).single(),
    admin.from('profiles').select('display_name').eq('id', event.logged_by).maybeSingle(),
    admin
      .from('household_members')
      .select('user_id')
      .eq('household_id', event.household_id)
      .eq('notify_events', true)
      .neq('user_id', event.logged_by)
      .or(activeMembersFilter()),
  ])

  const recipients = (members ?? []).map((m) => m.user_id)
  if (!recipients.length) return json({ sent: 0, recipients: 0 })

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, failure_count')
    .in('user_id', recipients)
  if (!subs?.length) return json({ sent: 0, recipients: recipients.length })

  const { title, body } = eventMessage(
    {
      type: event.type,
      walkLength: event.walk_length,
      occurredAt: event.occurred_at,
      createdAt: event.created_at,
      pee: event.pee,
      poop: event.poop,
      note: event.note,
      hasPhoto: !!event.photo_path,
    },
    logger?.display_name ?? 'Någon',
    dog?.name ?? 'hunden',
    household?.time_zone ?? 'Europe/Stockholm',
  )

  const result = await sendPush(admin, subs as PushSubscriptionRow[], { title, body, tag: `event-${event.id}`, url: '/' })
  return json({ ...result, recipients: recipients.length })
})
