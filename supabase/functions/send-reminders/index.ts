// Anropas av pg_cron (via trigger_reminders) när påminnelser väntar.
// Kräver ingen inloggning: claim_due_reminders() lämnar bara ut varje påminnelse en gång, i rätt tid.
import { adminClient, corsHeaders, json } from '../_shared/supabase.ts'
import { sendPush, type PushSubscriptionRow } from '../_shared/push.ts'
import { reminderMessage } from '../_shared/messages.ts'
import { reminderRecipients, type MemberPref } from '../_shared/recipients.ts'

interface DueReminder {
  schedule_id: string
  occurrence_at: string
  household_id: string
  dog_name: string
  type: 'walk' | 'meal'
  responsible_user_id: string | null
  responsible_name: string | null
  minutes_before: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = adminClient()

  const { data: due, error } = await admin.rpc('claim_due_reminders')
  if (error) {
    console.error('claim_due_reminders', error)
    return json({ error: 'db' }, 500)
  }
  const reminders = (due ?? []) as DueReminder[]
  let sent = 0

  for (const r of reminders) {
    const { data: members } = await admin
      .from('household_members')
      .select('user_id, notify_reminders')
      .eq('household_id', r.household_id)
    const recipients = reminderRecipients((members ?? []) as MemberPref[], r.responsible_user_id)
    if (!recipients.length) continue

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, failure_count')
      .in('user_id', recipients)
    if (!subs?.length) continue

    // Den ansvariga får "Det är din tur", övriga "Ester har turen".
    const groups = new Map<boolean, PushSubscriptionRow[]>()
    for (const sub of subs as PushSubscriptionRow[]) {
      const isResponsible = sub.user_id === r.responsible_user_id
      groups.set(isResponsible, [...(groups.get(isResponsible) ?? []), sub])
    }
    for (const [isResponsible, group] of groups) {
      const { title, body } = reminderMessage(r.type, r.dog_name, r.minutes_before, r.responsible_name, isResponsible)
      const result = await sendPush(admin, group, {
        title,
        body,
        tag: `reminder-${r.schedule_id}-${r.occurrence_at}`,
        url: '/',
      })
      sent += result.sent
    }
  }

  return json({ reminders: reminders.length, sent })
})
