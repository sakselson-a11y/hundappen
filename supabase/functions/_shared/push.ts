import webpush from 'npm:web-push@3.6.7'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export interface PushPayload {
  title: string
  body: string
  // Sökväg i appen som öppnas när man trycker på notisen.
  url?: string
  // Notiser med samma tag ersätter varandra.
  tag?: string
}

export interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  failure_count: number
}

let configured = false
function configure() {
  if (configured) return
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'https://sakselson-a11y.github.io/hundappen/',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )
  configured = true
}

// Skickar till alla angivna prenumerationer. Döda prenumerationer tas bort.
export async function sendPush(
  admin: SupabaseClient,
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  configure()
  let sent = 0
  let failed = 0
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60, urgency: 'high' },
        )
        sent++
        await admin
          .from('push_subscriptions')
          .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
          .eq('id', sub.id)
      } catch (err) {
        failed++
        const status = (err as { statusCode?: number }).statusCode
        console.error('push misslyckades', status, (err as Error).message)
        // 404/410 = prenumerationen finns inte längre (appen borttagen, notiser avstängda).
        if (status === 404 || status === 410 || sub.failure_count >= 5) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          await admin
            .from('push_subscriptions')
            .update({ failure_count: sub.failure_count + 1 })
            .eq('id', sub.id)
        }
      }
    }),
  )
  return { sent, failed }
}
