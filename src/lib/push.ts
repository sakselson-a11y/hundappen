import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase.ts'
import { iosTooOld, isIOS, isStandalone, supportsPush } from '../pwa.ts'

export type PushStatus =
  | 'loading'
  | 'needs-install' // iPhone i Safari: måste läggas på hemskärmen först
  | 'unsupported' // för gammal iOS eller webbläsare utan stöd
  | 'off' // inte påslaget på den här enheten
  | 'denied' // användaren har nekat i systemet
  | 'on'

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!supportsPush()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function getPushStatus(): Promise<PushStatus> {
  if (isIOS() && iosTooOld()) return 'unsupported'
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!supportsPush()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  return (await currentSubscription()) ? 'on' : 'off'
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    sub_endpoint: sub.endpoint,
    sub_p256dh: json.keys?.p256dh,
    sub_auth: json.keys?.auth,
    sub_user_agent: navigator.userAgent,
  })
  if (error) throw error
}

// Måste anropas direkt från ett knapptryck (krav i iOS).
export async function enablePush(): Promise<PushStatus> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  const { data, error } = await supabase.functions.invoke('vapid-public-key', { method: 'GET' })
  if (error || !data?.publicKey) throw error ?? new Error('Saknar VAPID-nyckel')

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  const key = base64UrlToUint8Array(data.publicKey)
  // Byts nyckeln på servern måste enheten prenumerera på nytt.
  if (sub && sub.options.applicationServerKey) {
    const existing = new Uint8Array(sub.options.applicationServerKey)
    if (existing.length !== key.length || existing.some((b, i) => b !== key[i])) {
      await sub.unsubscribe()
      sub = null
    }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  await saveSubscription(sub)
  return 'on'
}

// Ser till att servern har enhetens prenumeration (t.ex. efter ny inloggning).
export async function syncPushSubscription(): Promise<void> {
  if (!supportsPush() || Notification.permission !== 'granted') return
  const sub = await currentSubscription()
  if (sub) await saveSubscription(sub).catch(() => undefined)
}

// Vid utloggning: sluta skicka notiser till den här enheten.
export async function removeThisDevice(): Promise<void> {
  const sub = await currentSubscription().catch(() => null)
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe().catch(() => undefined)
}

export async function sendTestPush(): Promise<{ sent: number; devices: number }> {
  const { data, error } = await supabase.functions.invoke('send-test-push', { method: 'POST' })
  if (error) throw error
  return data
}

export function usePushStatus(): [PushStatus, (s: PushStatus) => void, () => void] {
  const [status, setStatus] = useState<PushStatus>('loading')
  const refresh = useCallback(() => {
    getPushStatus().then(setStatus)
  }, [])
  useEffect(() => {
    refresh()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])
  return [status, setStatus, refresh]
}
