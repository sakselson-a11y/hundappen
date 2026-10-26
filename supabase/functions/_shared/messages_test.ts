import { assertEquals } from 'jsr:@std/assert@1'
import { eventMessage, type EventInfo } from './messages.ts'

const base: EventInfo = {
  type: 'walk',
  occurredAt: '2026-10-26T14:40:00Z',
  createdAt: '2026-10-26T14:40:05Z',
  pee: null,
  poop: null,
  note: null,
  hasPhoto: false,
}

Deno.test('rastning med kiss och bajs och kommentar', () => {
  assertEquals(
    eventMessage({ ...base, pee: true, poop: true, note: 'Träffade grannens hund' }, 'Ester', 'Tucci', 'Europe/Stockholm'),
    { title: '🦮 Ester har rastat Tucci', body: 'Kiss och bajs · Träffade grannens hund' },
  )
})

Deno.test('mat utan detaljer', () => {
  assertEquals(eventMessage({ ...base, type: 'meal' }, 'Sven', 'Tucci', 'Europe/Stockholm'), {
    title: '🍖 Sven har gett Tucci mat',
    body: '',
  })
})

Deno.test('loggat i efterhand visar lokal tid', () => {
  const msg = eventMessage(
    { ...base, occurredAt: '2026-10-26T12:10:00Z', createdAt: '2026-10-26T14:40:00Z', pee: true, hasPhoto: true },
    'Ester',
    'Tucci',
    'Europe/Stockholm',
  )
  assertEquals(msg.body, 'kl. 13:10 · Kiss · 📷')
})

Deno.test('sommartid räknas rätt', () => {
  const msg = eventMessage(
    { ...base, occurredAt: '2026-07-01T05:00:00Z', createdAt: '2026-07-01T07:00:00Z' },
    'Ester',
    'Tucci',
    'Europe/Stockholm',
  )
  assertEquals(msg.body, 'kl. 07:00')
})
