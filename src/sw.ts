/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

// Förladda appens filer så att den startar snabbt och fungerar offline.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.skipWaiting()
clientsClaim()

interface PushPayload {
  title?: string
  body?: string
  url?: string
  tag?: string
}

// iOS kräver att varje push visar en notis, annars kan tillståndet dras in.
self.addEventListener('push', (event) => {
  let payload: PushPayload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = { body: event.data?.text() }
  }
  const scope = self.registration.scope
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Hundappen', {
      body: payload.body ?? '',
      icon: `${scope}icons/icon-192.png`,
      badge: `${scope}icons/icon-192.png`,
      tag: payload.tag,
      data: { url: new URL((payload.url ?? '/').replace(/^\//, ''), scope).href },
    }),
  )
})

// Tryck på notisen: visa appen (öppna den om den är stängd).
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url: string = event.notification.data?.url ?? self.registration.scope
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((w) => w.url.startsWith(self.registration.scope))
      if (existing) {
        await existing.focus()
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
