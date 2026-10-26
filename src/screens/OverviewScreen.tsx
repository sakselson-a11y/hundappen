import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEvents } from '../household/EventsProvider.tsx'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import { formatTime, relativeTime, useNow } from '../lib/time.ts'
import DogCard from '../components/DogCard.tsx'
import LogSheet from '../components/LogSheet.tsx'
import type { Dog, DogEvent, EventType } from '../lib/types.ts'

function LatestRow({ label, event }: { label: string; event: DogEvent | undefined }) {
  const { t, i18n } = useTranslation()
  const { memberName } = useHousehold()
  const now = useNow()
  return (
    <div className="latest">
      <span className="latest-label">{label}</span>
      {event ? (
        <>
          <span className="latest-time">
            {formatTime(event.occurred_at, i18n.language)}
            <span className="muted"> · {relativeTime(t, event.occurred_at, i18n.language, now)}</span>
          </span>
          <span className="muted small">
            {memberName(event.logged_by) ?? t('history.formerMember')}
            {event.pee && ` · 💧 ${t('log.pee')}`}
            {event.poop && ` · 💩 ${t('log.poop')}`}
          </span>
        </>
      ) : (
        <span className="muted">{t('overview.never')}</span>
      )}
    </div>
  )
}

export default function OverviewScreen({ dog, onEditDog }: { dog: Dog; onEditDog: () => void }) {
  const { t } = useTranslation()
  const { events, loading } = useEvents()
  const [logging, setLogging] = useState<EventType | null>(null)
  const lastWalk = events.find((e) => e.type === 'walk' && e.dog_id === dog.id)
  const lastMeal = events.find((e) => e.type === 'meal' && e.dog_id === dog.id)

  return (
    <>
      <DogCard dog={dog} onEdit={onEditDog} />

      <div className="log-buttons">
        <button className="log-button" onClick={() => setLogging('walk')}>
          <span aria-hidden>🦮</span>
          {t('overview.logWalk')}
        </button>
        <button className="log-button" onClick={() => setLogging('meal')}>
          <span aria-hidden>🍖</span>
          {t('overview.logMeal')}
        </button>
      </div>

      <section className="card">
        {loading ? (
          <p className="muted">{t('common.loading')}</p>
        ) : (
          <>
            <LatestRow label={t('overview.lastWalk')} event={lastWalk} />
            <LatestRow label={t('overview.lastMeal')} event={lastMeal} />
          </>
        )}
      </section>

      {logging && <LogSheet dog={dog} type={logging} onClose={() => setLogging(null)} />}
    </>
  )
}
