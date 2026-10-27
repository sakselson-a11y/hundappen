import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import LogSheet from '../components/LogSheet.tsx'
import { useEvents } from '../household/EventsProvider.tsx'
import { dayLabel, localDateKey, useNow } from '../lib/time.ts'
import { deleteEvent } from '../lib/deleteEvent.ts'
import EventItem from '../components/EventItem.tsx'
import type { DogEvent } from '../lib/types.ts'

export default function HistoryScreen() {
  const { t, i18n } = useTranslation()
  const { session } = useAuth()
  const { dogs } = useHousehold()
  const { events, loading, hasMore, loadMore, removeLocal, removePending } = useEvents()
  const [loadingMore, setLoadingMore] = useState(false)
  const [editing, setEditing] = useState<DogEvent | null>(null)
  const now = useNow(60000)

  async function remove(event: DogEvent) {
    if (!window.confirm(event.pending ? t('history.confirmDeletePending') : t('history.confirmDelete'))) return
    if (event.pending) await removePending(event.id)
    else if (await deleteEvent(event)) removeLocal(event.id)
    else window.alert(t('errors.generic'))
  }

  const editingDog = editing ? dogs.find((d) => d.id === editing.dog_id) : undefined

  if (loading) return <p className="muted center">{t('common.loading')}</p>
  if (!events.length)
    return (
      <section className="card">
        <h2>{t('history.title')}</h2>
        <p className="muted">{t('history.empty')}</p>
      </section>
    )

  const days: { key: string; items: DogEvent[] }[] = []
  for (const e of events) {
    const key = localDateKey(e.occurred_at)
    const last = days[days.length - 1]
    if (last?.key === key) last.items.push(e)
    else days.push({ key, items: [e] })
  }

  return (
    <>
      {days.map((day) => (
        <section className="card" key={day.key}>
          <h2 className="day-title">{dayLabel(t, day.key, i18n.language, now)}</h2>
          <ul className="events">
            {day.items.map((e) => (
              <EventItem
                key={e.id}
                event={e}
                isOwn={e.logged_by === session?.user.id}
                onEdit={setEditing}
                onDelete={remove}
              />
            ))}
          </ul>
        </section>
      ))}
      {hasMore && (
        <button
          className="secondary full"
          disabled={loadingMore}
          onClick={async () => {
            setLoadingMore(true)
            await loadMore()
            setLoadingMore(false)
          }}
        >
          {loadingMore ? t('common.wait') : t('history.loadMore')}
        </button>
      )}
      {editing && editingDog && (
        <LogSheet dog={editingDog} type={editing.type} event={editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
