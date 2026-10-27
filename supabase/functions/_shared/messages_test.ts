import { assertEquals } from 'jsr:@std/assert@1'
import { dayWord, eventMessage, reminderMessage, swapMessage, type EventInfo } from './messages.ts'

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

Deno.test('byt tur: den som tar turen själv', () => {
  assertEquals(
    swapMessage({ activity: 'lång promenad', time: '18:00', day: 'idag', takerName: 'Sven', previousName: 'Ester', changerName: 'Sven', recipientIsTaker: false, takerIsChanger: true }),
    { title: '🔁 Sven tar lång promenad 18:00 idag', body: 'I stället för Ester' },
  )
})

Deno.test('byt tur: någon annan ger dig turen', () => {
  assertEquals(
    swapMessage({ activity: 'mat', time: '17:30', day: 'imorgon', takerName: 'Ester', previousName: 'Sven', changerName: 'Sven', recipientIsTaker: true, takerIsChanger: false }),
    { title: '🔁 Du tar mat 17:30 imorgon', body: 'I stället för Sven · Ändrat av Sven' },
  )
})

Deno.test('dagord i Stockholmstid', () => {
  const now = new Date('2026-10-27T23:30:00Z') // 00:30 den 28 okt i Stockholm (vintertid, UTC+1)
  assertEquals(dayWord('2026-10-28', now, 'Europe/Stockholm'), 'idag')
  assertEquals(dayWord('2026-10-29', now, 'Europe/Stockholm'), 'imorgon')
  assertEquals(dayWord('2026-10-30', now, 'Europe/Stockholm'), 'på fredag')
})
