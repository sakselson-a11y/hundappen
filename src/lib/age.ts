import type { TFunction } from 'i18next'

// "3 år", "1 år och 4 månader", "5 månader", "2 veckor"
export function formatAge(t: TFunction, birthDate: string, today = new Date()): string {
  const birth = new Date(birthDate + 'T00:00:00')
  let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth())
  if (today.getDate() < birth.getDate()) months -= 1
  if (months < 0) return ''
  if (months === 0) {
    const weeks = Math.floor((today.getTime() - birth.getTime()) / (7 * 24 * 3600 * 1000))
    return t('age.weeks', { count: Math.max(weeks, 0) })
  }
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return t('age.months', { count: rest })
  if (rest === 0 || years >= 3) return t('age.years', { count: years })
  return t('age.yearsAndMonths', { years, months: t('age.months', { count: rest }) })
}
