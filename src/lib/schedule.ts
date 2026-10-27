// Beräkningar för schemat. Schematider gäller i hushållets tidszon (klarar sommartid);
// resultaten är vanliga Date-objekt (UTC) som visas i telefonens tidszon.
import type { DogEvent, Schedule, ScheduleOverride } from './types.ts'

// Hur länge efter schemalagd tid en logg fortfarande räknas, och när den räknas som missad.
export const GRACE_AFTER_MINUTES = 120

export interface Ymd {
  year: number
  month: number // 1–12
  day: number
}

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
    isoWeekday: weekdays.indexOf(get('weekday')) + 1,
  }
}

// Tidszonens avvikelse från UTC i minuter vid en viss tidpunkt (t.ex. 60 eller 120 för Stockholm).
function offsetMinutes(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000)
}

// "07:00" en viss dag i en viss tidszon → exakt tidpunkt.
export function zonedTime(ymd: Ymd, hhmm: string, timeZone: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const guess = Date.UTC(ymd.year, ymd.month - 1, ymd.day, h, m)
  let result = guess - offsetMinutes(new Date(guess), timeZone) * 60000
  const second = guess - offsetMinutes(new Date(result), timeZone) * 60000
  if (second !== result) result = second
  return new Date(result)
}

export function todayInZone(now: Date, timeZone: string): Ymd & { isoWeekday: number } {
  const p = partsInZone(now, timeZone)
  return { year: p.year, month: p.month, day: p.day, isoWeekday: p.isoWeekday }
}

function addDays(ymd: Ymd, days: number): Ymd & { isoWeekday: number } {
  const d = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + days))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), isoWeekday: ((d.getUTCDay() + 6) % 7) + 1 }
}

export interface Occurrence {
  schedule: Schedule
  at: Date
}

// Alla schemalagda tillfällen en viss dag (i hushållets tidszon), sorterade på tid.
export function occurrencesOnDay(schedules: Schedule[], ymd: Ymd & { isoWeekday: number }, timeZone: string): Occurrence[] {
  return schedules
    .filter((s) => s.active && s.days_of_week.includes(ymd.isoWeekday))
    .map((s) => ({ schedule: s, at: zonedTime(ymd, s.local_time.slice(0, 5), timeZone) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
}

// Nästa kommande tillfälle (inom en vecka), valfritt filtrerat på typ.
export function nextOccurrence(
  schedules: Schedule[],
  now: Date,
  timeZone: string,
  type?: Schedule['type'],
): Occurrence | null {
  const relevant = schedules.filter((s) => !type || s.type === type)
  const today = todayInZone(now, timeZone)
  for (let i = 0; i <= 7; i++) {
    const next = occurrencesOnDay(relevant, addDays(today, i), timeZone).find((o) => o.at > now)
    if (next) return next
  }
  return null
}

export type OccurrenceStatus = 'done' | 'upcoming' | 'due' | 'missed'

// Samma regel som public.event_satisfies i databasen: en lång promenad räknas även för en
// schemalagd kort rastning, men en kort rastning räknas inte för en lång promenad.
export function eventSatisfies(schedule: Schedule, event: DogEvent): boolean {
  if (schedule.type !== event.type) return false
  if (schedule.type !== 'walk') return true
  return (schedule.walk_length ?? 'short') === 'short' || event.walk_length === 'long'
}

// En logg räknas för tillfället om den skett från (tid − skip_window) till (tid + 2 tim).
export function matchingEvent(occ: Occurrence, events: DogEvent[]): DogEvent | undefined {
  const from = occ.at.getTime() - occ.schedule.skip_window_minutes * 60000
  const to = occ.at.getTime() + GRACE_AFTER_MINUTES * 60000
  return events.find((e) => {
    const t = new Date(e.occurred_at).getTime()
    return eventSatisfies(occ.schedule, e) && e.dog_id === occ.schedule.dog_id && t >= from && t <= to
  })
}

export function occurrenceStatus(occ: Occurrence, events: DogEvent[], now: Date): OccurrenceStatus {
  if (matchingEvent(occ, events)) return 'done'
  const diff = now.getTime() - occ.at.getTime()
  if (diff < 0) return 'upcoming'
  if (diff <= GRACE_AFTER_MINUTES * 60000) return 'due'
  return 'missed'
}

// Veckodagar som text-nyckel: 'everyDay' | 'weekdays' | 'weekends' | null (= lista dagarna).
export function daysPreset(days: number[]): 'everyDay' | 'weekdays' | 'weekends' | null {
  const key = [...days].sort().join(',')
  if (key === '1,2,3,4,5,6,7') return 'everyDay'
  if (key === '1,2,3,4,5') return 'weekdays'
  if (key === '6,7') return 'weekends'
  return null
}

export function ymdKey(ymd: Ymd): string {
  return `${ymd.year}-${String(ymd.month).padStart(2, '0')}-${String(ymd.day).padStart(2, '0')}`
}

// Vems tur ett visst tillfälle är: ett byte för just den dagen går före schemat.
export function responsibleFor(
  schedule: Schedule,
  dateKey: string,
  overrides: ScheduleOverride[],
): { userId: string | null; overridden: boolean } {
  const o = overrides.find((x) => x.schedule_id === schedule.id && x.occurrence_date === dateKey)
  return o ? { userId: o.responsible_user_id, overridden: true } : { userId: schedule.responsible_user_id, overridden: false }
}
