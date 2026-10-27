import { assertEquals } from 'jsr:@std/assert@1'
import { eventMessage, reminderMessage, type EventInfo } from './messages.ts'

const base: EventInfo = {
  type: 'walk',
  walkLength: null,
  occurredAt: '2026-10-26T14:40:00Z',
  createdAt: '2026-10-26T14:40:05Z',
  pee: null,
  poop: null,
  note: null,
  hasPhoto: false,
}

Deno.test('lång promenad med nummer 1 och 2 och kommentar', () => {
  assertEquals(
    eventMessage(
      { ...base, walkLength: 'long', pee: true, poop: true, note: 'Träffade grannens hund' },
      'Ester',
      'Tucci',
      'Europe/Stockholm',
    ),
    { title: '🦮 Ester har rastat Tucci', body: 'Lång promenad · Nummer 1 och 2 · Träffade grannens hund' },
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
  assertEquals(msg.body, 'kl. 13:10 · Nummer 1 · 📷')
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
  assertEquals(reminderMessage('walk', 'long', 'Tucci', 15, 'Ester', false), {
    title: '🦮 Tucci ska ut om 15 minuter',
    body: 'Lång promenad · Ester har turen',
  })
})

Deno.test('påminnelse till den ansvariga', () => {
  assertEquals(reminderMessage('meal', null, 'Tucci', 10, 'Ester', true), {
    title: '🍖 Tucci ska äta om 10 minuter',
    body: 'Det är din tur 🐾',
  })
})

Deno.test('påminnelse vid tiden utan ansvarig', () => {
  assertEquals(reminderMessage('walk', 'short', 'Tucci', 0, null, false), {
    title: '🦮 Dags att gå ut med Tucci',
    body: 'Kort rastning · Vem tar det?',
  })
})
