// Notistexter. Svenska nu; fler språk läggs till per locale.

export interface EventInfo {
  type: 'walk' | 'meal'
  occurredAt: string
  createdAt: string
  pee: boolean | null
  poop: boolean | null
  note: string | null
  hasPhoto: boolean
}

function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone })
}

// Ex: { title: "🦮 Ester har rastat Tucci", body: "Kiss och bajs · Träffade grannens hund" }
export function eventMessage(
  event: EventInfo,
  who: string,
  dog: string,
  timeZone: string,
): { title: string; body: string } {
  const title = event.type === 'walk' ? `🦮 ${who} har rastat ${dog}` : `🍖 ${who} har gett ${dog} mat`

  const parts: string[] = []
  // Loggat i efterhand (mer än 10 min före sparandet): visa när det hände.
  const lateMinutes = (new Date(event.createdAt).getTime() - new Date(event.occurredAt).getTime()) / 60000
  if (lateMinutes > 10) parts.push(`kl. ${formatTime(event.occurredAt, timeZone)}`)
  if (event.type === 'walk') {
    if (event.pee && event.poop) parts.push('Kiss och bajs')
    else if (event.pee) parts.push('Kiss')
    else if (event.poop) parts.push('Bajs')
  }
  if (event.note) parts.push(event.note.length > 120 ? `${event.note.slice(0, 117)}…` : event.note)
  if (event.hasPhoto) parts.push('📷')

  return { title, body: parts.join(' · ') }
}

// Ex: { title: "🦮 Tucci ska ut om 15 minuter", body: "Ester har turen" }
export function reminderMessage(
  type: 'walk' | 'meal',
  dog: string,
  minutesBefore: number,
  responsibleName: string | null,
  recipientIsResponsible: boolean,
): { title: string; body: string } {
  const icon = type === 'walk' ? '🦮' : '🍖'
  const when = minutesBefore > 0 ? `om ${minutesBefore} minuter` : 'nu'
  const title =
    minutesBefore > 0
      ? type === 'walk'
        ? `${icon} ${dog} ska ut ${when}`
        : `${icon} ${dog} ska äta ${when}`
      : type === 'walk'
        ? `${icon} Dags att gå ut med ${dog}`
        : `${icon} Dags för ${dog}s mat`
  const body = recipientIsResponsible
    ? 'Det är din tur 🐾'
    : responsibleName
      ? `${responsibleName} har turen`
      : 'Vem tar det?'
  return { title, body }
}
