// Länkar från notiser, t.ex. "?log=walk&length=long" från en påminnelse:
// öppna loggformuläret direkt med rätt sak förvald.
import type { EventType, WalkLength } from './types.ts'

export interface LogRequest {
  type: EventType
  length?: WalkLength
}

const EVENT = 'hundappen:log-request'
let pending: LogRequest | null = null

function parse(url: string): LogRequest | null {
  const params = new URL(url, window.location.href).searchParams
  const type = params.get('log')
  if (type !== 'walk' && type !== 'meal') return null
  const length = params.get('length')
  return { type, length: length === 'short' || length === 'long' ? length : undefined }
}

function publish(request: LogRequest) {
  pending = request
  window.dispatchEvent(new CustomEvent(EVENT))
}

// Vid start: läs adressen och ta bort parametrarna ur adressfältet.
export function captureLogRequestFromUrl(): void {
  const request = parse(window.location.href)
  if (!request) return
  pending = request
  const params = new URLSearchParams(window.location.search)
  params.delete('log')
  params.delete('length')
  const query = params.toString()
  window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash)
}

// När appen redan är öppen skickar service workern adressen hit i stället.
export function listenForNotificationClicks(): void {
  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type !== 'notification-click') return
    const request = parse(event.data.url)
    if (request) publish(request)
  })
}

// Hämtar (och tömmer) en väntande begäran, och anropar callback när nya kommer.
export function subscribeLogRequests(callback: (request: LogRequest) => void): () => void {
  const deliver = () => {
    if (!pending) return
    const request = pending
    pending = null
    callback(request)
  }
  deliver()
  window.addEventListener(EVENT, deliver)
  return () => window.removeEventListener(EVENT, deliver)
}
