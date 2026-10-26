import { useEffect, useState } from 'react'
import type { TFunction } from 'i18next'

// Alla tider sparas i UTC och visas i telefonens tidszon.

export function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

export function localDateKey(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dayLabel(t: TFunction, dateKey: string, locale: string, now = new Date()): string {
  const today = localDateKey(now)
  const yesterday = localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  if (dateKey === today) return t('time.today')
  if (dateKey === yesterday) return t('time.yesterday')
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(y !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

// "nyss", "för 25 min sedan", "för 3 tim sedan", "igår", "mån 24 okt" (klockslaget visas separat)
export function relativeTime(t: TFunction, iso: string, locale: string, now = new Date()): string {
  const diffMin = Math.round((now.getTime() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return t('time.justNow')
  if (diffMin < 60) return t('time.minutesAgo', { count: diffMin })
  if (diffMin < 12 * 60 || localDateKey(iso) === localDateKey(now)) {
    const h = Math.floor(diffMin / 60)
    const m = diffMin % 60
    return m && h < 3 ? t('time.hoursMinutesAgo', { h, m }) : t('time.hoursAgo', { count: h })
  }
  if (dayLabel(t, localDateKey(iso), locale, now) === t('time.yesterday')) return t('time.yesterday').toLowerCase()
  return new Date(iso).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

// Värde för <input type="datetime-local"> i lokal tid.
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Gör att "för 5 min sedan" uppdateras av sig själv.
export function useNow(intervalMs = 30000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    const onVisible = () => document.visibilityState === 'visible' && setNow(new Date())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])
  return now
}
