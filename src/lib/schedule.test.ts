import { describe, expect, it } from 'vitest'
import { matchingEvent, nextOccurrence, occurrencesOnDay, occurrenceStatus, todayInZone, zonedTime } from './schedule.ts'
import type { DogEvent, Schedule } from './types.ts'

const TZ = 'Europe/Stockholm'

function schedule(over: Partial<Schedule> = {}): Schedule {
  return {
    id: 's1',
    household_id: 'h',
    dog_id: 'd',
    type: 'walk',
    local_time: '07:00:00',
    days_of_week: [1, 2, 3, 4, 5, 6, 7],
    responsible_user_id: null,
    remind_minutes_before: 15,
    skip_window_minutes: 60,
    active: true,
    created_by: null,
    created_at: '',
    ...over,
  }
}

function event(at: string, type: DogEvent['type'] = 'walk'): DogEvent {
  return { id: at, household_id: 'h', dog_id: 'd', type, occurred_at: at, logged_by: 'u', pee: null, poop: null, note: null, photo_path: null, created_at: at }
}

describe('zonedTime', () => {
  it('vintertid: 07:00 i Stockholm är 06:00 UTC', () => {
    expect(zonedTime({ year: 2026, month: 11, day: 2 }, '07:00', TZ).toISOString()).toBe('2026-11-02T06:00:00.000Z')
  })
  it('sommartid: 07:00 i Stockholm är 05:00 UTC', () => {
    expect(zonedTime({ year: 2026, month: 7, day: 1 }, '07:00', TZ).toISOString()).toBe('2026-07-01T05:00:00.000Z')
  })
  it('dagen då sommartiden slutar (25 okt 2026)', () => {
    expect(zonedTime({ year: 2026, month: 10, day: 25 }, '07:00', TZ).toISOString()).toBe('2026-10-25T06:00:00.000Z')
    expect(zonedTime({ year: 2026, month: 10, day: 24 }, '07:00', TZ).toISOString()).toBe('2026-10-24T05:00:00.000Z')
  })
  it('dagen då sommartiden börjar (29 mars 2026)', () => {
    expect(zonedTime({ year: 2026, month: 3, day: 29 }, '07:00', TZ).toISOString()).toBe('2026-03-29T05:00:00.000Z')
  })
  it('annan tidszon', () => {
    expect(zonedTime({ year: 2026, month: 11, day: 2 }, '07:00', 'America/New_York').toISOString()).toBe('2026-11-02T12:00:00.000Z')
  })
})

describe('todayInZone', () => {
  it('sent på kvällen UTC är redan nästa dag i Stockholm', () => {
    expect(todayInZone(new Date('2026-11-01T23:30:00Z'), TZ)).toEqual({ year: 2026, month: 11, day: 2, isoWeekday: 1 })
  })
})

describe('occurrencesOnDay', () => {
  it('filtrerar på veckodag och aktiv, sorterar på tid', () => {
    const list = [
      schedule({ id: 'kväll', local_time: '18:00:00' }),
      schedule({ id: 'morgon', local_time: '07:00:00' }),
      schedule({ id: 'helg', local_time: '09:00:00', days_of_week: [6, 7] }),
      schedule({ id: 'av', active: false }),
    ]
    const monday = { year: 2026, month: 11, day: 2, isoWeekday: 1 }
    expect(occurrencesOnDay(list, monday, TZ).map((o) => o.schedule.id)).toEqual(['morgon', 'kväll'])
  })
})

describe('nextOccurrence', () => {
  it('hittar nästa samma dag', () => {
    const next = nextOccurrence([schedule(), schedule({ id: 'kväll', local_time: '18:00:00' })], new Date('2026-11-02T08:00:00Z'), TZ)
    expect(next?.schedule.id).toBe('kväll')
    expect(next?.at.toISOString()).toBe('2026-11-02T17:00:00.000Z')
  })
  it('hoppar till nästa matchande veckodag', () => {
    const next = nextOccurrence([schedule({ days_of_week: [6] })], new Date('2026-11-02T08:00:00Z'), TZ)
    expect(next?.at.toISOString()).toBe('2026-11-07T06:00:00.000Z')
  })
  it('filtrerar på typ', () => {
    const next = nextOccurrence([schedule(), schedule({ id: 'mat', type: 'meal', local_time: '08:00:00' })], new Date('2026-11-02T05:00:00Z'), TZ, 'meal')
    expect(next?.schedule.id).toBe('mat')
  })
  it('null utan aktiva scheman', () => {
    expect(nextOccurrence([schedule({ active: false })], new Date(), TZ)).toBeNull()
  })
})

describe('status', () => {
  const occ = { schedule: schedule(), at: new Date('2026-11-02T06:00:00Z') } // 07:00 svensk tid
  it('klar om rastning skett inom fönstret före', () => {
    expect(occurrenceStatus(occ, [event('2026-11-02T05:20:00Z')], new Date('2026-11-02T05:30:00Z'))).toBe('done')
  })
  it('logg för tidigt räknas inte', () => {
    expect(matchingEvent(occ, [event('2026-11-02T04:50:00Z')])).toBeUndefined()
  })
  it('fel typ räknas inte', () => {
    expect(matchingEvent(occ, [event('2026-11-02T05:50:00Z', 'meal')])).toBeUndefined()
  })
  it('kommande, aktuell och missad', () => {
    expect(occurrenceStatus(occ, [], new Date('2026-11-02T05:00:00Z'))).toBe('upcoming')
    expect(occurrenceStatus(occ, [], new Date('2026-11-02T07:00:00Z'))).toBe('due')
    expect(occurrenceStatus(occ, [], new Date('2026-11-02T08:30:00Z'))).toBe('missed')
  })
})
