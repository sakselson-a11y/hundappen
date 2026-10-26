import { assertEquals } from 'jsr:@std/assert@1'
import { eventMessage, reminderMessage, type EventInfo } from './messages.ts'

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

Deno.test('påminnelse till andra än den ansvariga', () => {
  assertEquals(reminderMessage('walk', 'Tucci', 15, 'Ester', false), {
    title: '🦮 Tucci ska ut om 15 minuter',
    body: 'Ester har turen',
  })
})

Deno.test('påminnelse till den ansvariga', () => {
  assertEquals(reminderMessage('meal', 'Tucci', 10, 'Ester', true), {
    title: '🍖 Tucci ska äta om 10 minuter',
    body: 'Det är din tur 🐾',
  })
})

Deno.test('påminnelse vid tiden utan ansvarig', () => {
  assertEquals(reminderMessage('walk', 'Tucci', 0, null, false), {
    title: '🦮 Dags att gå ut med Tucci',
    body: 'Vem tar det?',
  })
})
