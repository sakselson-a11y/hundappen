// Vem som ska få en påminnelse, utifrån varje medlems val (Familjen → Notiser).
export interface MemberPref {
  user_id: string
  notify_reminders: 'all' | 'mine' | 'none'
}

export function reminderRecipients(members: MemberPref[], responsibleUserId: string | null): string[] {
  return members
    .filter((m) => {
      if (m.notify_reminders === 'all') return true
      // "Bara min tur": utan särskild ansvarig räknas det som allas tur.
      if (m.notify_reminders === 'mine') return responsibleUserId === null || responsibleUserId === m.user_id
      return false
    })
    .map((m) => m.user_id)
}
