import type { TFunction } from 'i18next'
import { daysPreset } from './schedule.ts'

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

// "Varje dag", "Vardagar", "Helger" eller "mån, ons, fre"
export function daysText(t: TFunction, days: number[]): string {
  const preset = daysPreset(days)
  if (preset) return t(`schedule.days.${preset}`)
  return [...days]
    .sort()
    .map((d) => t(`schedule.dayShort.${DAY_KEYS[d - 1]}`))
    .join(', ')
}

export function dayShort(t: TFunction, isoDay: number): string {
  return t(`schedule.dayShort.${DAY_KEYS[isoDay - 1]}`)
}
