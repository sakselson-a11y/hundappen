import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider.tsx'
import SwapSheet from './SwapSheet.tsx'
import { useEvents } from '../household/EventsProvider.tsx'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import { useSchedules } from '../household/SchedulesProvider.tsx'
import {
  matchingEvent,
  nextOccurrence,
  occurrencesOnDay,
  occurrenceStatus,
  responsibleFor,
  todayInZone,
  ymdKey,
  type Occurrence,
} from '../lib/schedule.ts'
import { formatTime, useNow } from '../lib/time.ts'
import type { Dog } from '../lib/types.ts'
import { activityLabel } from '../lib/labels.ts'

// Dagens schema med status, plus nästa tillfälle om inget återstår idag.
export default function TodayCard({ dog, onOpenSchedule }: { dog: Dog; onOpenSchedule: () => void }) {
  const { t, i18n } = useTranslation()
  const { household, memberName } = useHousehold()
  const { session } = useAuth()
  const { schedules, overrides, loading } = useSchedules()
  const { events } = useEvents()
  const [swapping, setSwapping] = useState<Occurrence | null>(null)
  const now = useNow()
  const zone = household?.time_zone ?? 'Europe/Stockholm'
  const mine = schedules.filter((s) => s.dog_id === dog.id)

  if (loading) return null
  if (!mine.length)
    return (
      <section className="card">
        <h2>{t('today.title')}</h2>
        <p className="muted">{t('today.noSchedule')}</p>
        <button className="link" onClick={onOpenSchedule}>
          {t('today.createSchedule')}
        </button>
      </section>
    )

  const todayYmd = todayInZone(now, zone)
  const dateKey = ymdKey(todayYmd)
  const today = occurrencesOnDay(mine, todayYmd, zone)
  const nextId = today.find((o) => occurrenceStatus(o, events, now) !== 'done' && o.at > now)?.schedule.id
  const upcoming = nextOccurrence(mine, now, zone)
  const restOfDayEmpty = !today.some((o) => o.at > now)

  return (
    <section className="card">
      <h2>{t('today.title')}</h2>
      {!today.length && <p className="muted">{t('today.nothingToday')}</p>}
      <ul className="today-list">
        {today.map((occ) => {
          const status = occurrenceStatus(occ, events, now)
          const done = status === 'done' ? matchingEvent(occ, events) : undefined
          const turn = responsibleFor(occ.schedule, dateKey, overrides)
          const responsible = turn.userId ? memberName(turn.userId) : null
          const isMine = !!turn.userId && turn.userId === session?.user.id
          const isNext = occ.schedule.id === nextId
          const canSwap = status !== 'done'
          return (
            <li
              key={occ.schedule.id}
              className={`today-item ${status} ${isNext ? 'next' : ''} ${canSwap ? 'swappable' : ''}`}
              onClick={canSwap ? () => setSwapping(occ) : undefined}
              role={canSwap ? 'button' : undefined}
              aria-label={canSwap ? t('today.tapToSwap') : undefined}
            >
              <span className="today-time">{formatTime(occ.at.toISOString(), i18n.language)}</span>
              <span className="today-info">
                <strong>
                  {activityLabel(t, occ.schedule.type, occ.schedule.walk_length)}
                </strong>
                <span className="muted small">
                  {done
                    ? t('today.doneBy', {
                        name: memberName(done.logged_by) ?? t('history.formerMember'),
                        time: formatTime(done.occurred_at, i18n.language),
                      })
                    : isMine
                      ? t('today.yourTurn')
                      : responsible
                        ? t('today.turnOf', { name: responsible })
                      : t('today.anyone')}
                  {!done && turn.overridden && ` · 🔁 ${t('today.swapped')}`}
                </span>
              </span>
              <span className={`status-badge ${status}`}>
                {status === 'done' ? '✓' : isNext ? t('today.next') : t(`today.status.${status}`)}
              </span>
            </li>
          )
        })}
      </ul>
      {restOfDayEmpty && upcoming && (
        <p className="muted small next-line">
          {t('today.nextLater', {
            what: activityLabel(t, upcoming.schedule.type, upcoming.schedule.walk_length, false).toLowerCase(),
            when: `${relativeDay(t, upcoming.at, now, i18n.language)} ${formatTime(upcoming.at.toISOString(), i18n.language)}`,
          })}
        </p>
      )}
      {swapping && (
        <SwapSheet
          occurrence={swapping}
          dateKey={dateKey}
          currentResponsible={responsibleFor(swapping.schedule, dateKey, overrides).userId}
          overridden={responsibleFor(swapping.schedule, dateKey, overrides).overridden}
          onClose={() => setSwapping(null)}
        />
      )}
    </section>
  )
}

// "imorgon" eller veckodagens namn ("lördag").
function relativeDay(t: ReturnType<typeof useTranslation>['t'], at: Date, now: Date, locale: string): string {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (at.toDateString() === tomorrow.toDateString()) return t('today.tomorrow')
  return at.toLocaleDateString(locale, { weekday: 'long' })
}
