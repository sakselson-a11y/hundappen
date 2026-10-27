// Anropas av databasen när någon byter tur för ett tillfälle. Meddelar övriga i familjen.
// Kräver ingen inloggning: varje ändring meddelas högst en gång (notified_at).
import { adminClient, corsHeaders, json } from '../_shared/supabase.ts'
import { sendPush, type PushSubscriptionRow } from '../_shared/push.ts'
import { dayWord, swapMessage, walkLengthText } from '../_shared/messages.ts'
import { activeMembersFilter } from '../_shared/members.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const { schedule_id, occurrence_date } = await req.json().catch(() => ({}))
  if (typeof schedule_id !== 'string' || typeof occurrence_date !== 'string') return json({ error: 'parametrar saknas' }, 400)

  const admin = adminClient()
  // Hämta ändringen om den inte redan meddelats (och är färsk).
  const { data: candidate } = await admin
    .from('schedule_overrides')
    .select('*')
    .eq('schedule_id', schedule_id)
    .eq('occurrence_date', occurrence_date)
    .gt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .maybeSingle()
  if (!candidate || (candidate.notified_at && candidate.notified_at >= candidate.updated_at)) return json({ skipped: true })
  const { data: override } = await admin
    .from('schedule_overrides')
    .update({ notified_at: new Date().toISOString() })
    .eq('schedule_id', schedule_id)
    .eq('occurrence_date', occurrence_date)
    .eq('updated_at', candidate.updated_at)
    .select('*')
    .maybeSingle()
  if (!override) return json({ skipped: true })

  const [{ data: schedule }, { data: household }, { data: members }] = await Promise.all([
    admin.from('schedules').select('type, walk_length, local_time, responsible_user_id').eq('id', schedule_id).single(),
    admin.from('households').select('time_zone').eq('id', override.household_id).single(),
    admin
      .from('household_members')
      .select('user_id, notify_events, profile:profiles(display_name)')
      .eq('household_id', override.household_id)
      .or(activeMembersFilter()),
  ])
  if (!schedule || !members) return json({ error: 'saknas' }, 404)

  const nameOf = (id: string | null) =>
    (members.find((m) => m.user_id === id)?.profile as { display_name?: string } | null)?.display_name ?? null
  const takerName = nameOf(override.responsible_user_id)
  const previousName = nameOf(schedule.responsible_user_id)
  const changerName = nameOf(override.changed_by) ?? 'Någon'
  const activity = schedule.type === 'walk' ? (walkLengthText(schedule.walk_length) ?? 'Rastning').toLowerCase() : 'mat'

  // Alla utom den som ändrade; den som fick turen får alltid veta.
  const recipients = members
    .filter((m) => m.user_id !== override.changed_by && (m.notify_events || m.user_id === override.responsible_user_id))
    .map((m) => m.user_id)
  if (!recipients.length) return json({ sent: 0 })

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, failure_count')
    .in('user_id', recipients)

  let sent = 0
  for (const sub of (subs ?? []) as PushSubscriptionRow[]) {
    const { title, body } = swapMessage({
      activity,
      time: schedule.local_time.slice(0, 5),
      day: dayWord(occurrence_date, new Date(), household?.time_zone ?? 'Europe/Stockholm'),
      takerName,
      previousName,
      changerName,
      recipientIsTaker: sub.user_id === override.responsible_user_id,
      takerIsChanger: override.responsible_user_id === override.changed_by,
    })
    const result = await sendPush(admin, [sub], { title, body, tag: `swap-${schedule_id}-${occurrence_date}`, url: '/' })
    sent += result.sent
  }
  return json({ sent })
})
