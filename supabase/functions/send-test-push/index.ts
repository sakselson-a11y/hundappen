// Skickar en testnotis till den inloggade användarens alla enheter.
import { adminClient, corsHeaders, json, requireUser } from '../_shared/supabase.ts'
import { sendPush, type PushSubscriptionRow } from '../_shared/push.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = adminClient()
  const user = await requireUser(req, admin)
  if (!user) return json({ error: 'unauthorized' }, 401)

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, failure_count')
    .eq('user_id', user.id)
  if (error) return json({ error: 'db' }, 500)
  if (!subs?.length) return json({ sent: 0, failed: 0, devices: 0 })

  const result = await sendPush(admin, subs as PushSubscriptionRow[], {
    title: 'Hundappen',
    body: 'Testnotis – det fungerar! 🐾',
    tag: 'test',
    url: '/',
  })
  return json({ ...result, devices: subs.length })
})
