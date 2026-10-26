import { assertEquals } from 'jsr:@std/assert@1'
import { reminderRecipients } from './recipients.ts'

const members = [
  { user_id: 'sven', notify_reminders: 'all' as const },
  { user_id: 'ester', notify_reminders: 'mine' as const },
  { user_id: 'ingen', notify_reminders: 'none' as const },
]

Deno.test('Esters tur: alla som vill ha allt + Ester', () => {
  assertEquals(reminderRecipients(members, 'ester'), ['sven', 'ester'])
})

Deno.test('Svens tur: Ester (bara min tur) får inget', () => {
  assertEquals(reminderRecipients(members, 'sven'), ['sven'])
})

Deno.test('ingen ansvarig: räknas som allas tur', () => {
  assertEquals(reminderRecipients(members, null), ['sven', 'ester'])
})
