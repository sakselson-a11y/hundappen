// Notistexter. Svenska nu; fler språk läggs till per locale.

export interface EventInfo {
  type: 'walk' | 'meal'
  walkLength: 'short' | 'long' | null
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

export function walkLengthText(length: 'short' | 'long' | null): string | null {
  if (length === 'long') return 'Lång promenad'
  if (length === 'short') return 'Kort rastning'
  return null
}

// Ex: { title: "🦮 Ester har rastat Tucci", body: "Lång promenad · Nummer 1 och 2 · Träffade grannens hund" }
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
    const length = walkLengthText(event.walkLength)
    if (length) parts.push(length)
    if (event.pee && event.poop) parts.push('Nummer 1 och 2')
    else if (event.pee) parts.push('Nummer 1')
    else if (event.poop) parts.push('Nummer 2')
  }
  if (event.note) parts.push(event.note.length > 120 ? `${event.note.slice(0, 117)}…` : event.note)
  if (event.hasPhoto) parts.push('📷')

  return { title, body: parts.join(' · ') }
}

// Ex: { title: "🦮 Tucci ska ut om 15 minuter", body: "Lång promenad · Ester har turen" }
export function reminderMessage(
  type: 'walk' | 'meal',
  walkLength: 'short' | 'long' | null,
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
  const turn = recipientIsResponsible
    ? 'Det är din tur 🐾'
    : responsibleName
      ? `${responsibleName} har turen`
      : 'Vem tar det?'
  const length = type === 'walk' ? walkLengthText(walkLength) : null
  return { title, body: length ? `${length} · ${turn}` : turn }
}
