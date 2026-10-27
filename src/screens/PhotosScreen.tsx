import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.ts'
import { usePhotoUrls } from '../lib/photos.ts'
import { formatTime } from '../lib/time.ts'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import { useEvents } from '../household/EventsProvider.tsx'
import Sheet from '../components/Sheet.tsx'
import type { DogEvent } from '../lib/types.ts'

const PAGE_SIZE = 60

// Alla foton från loggarna, nyast först, grupperade per månad.
export default function PhotosScreen() {
  const { t, i18n } = useTranslation()
  const { household, memberName } = useHousehold()
  const { events: liveEvents } = useEvents()
  const [fetched, setFetched] = useState<DogEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const householdId = household?.id

  const load = useCallback(
    async (before?: string) => {
      if (!householdId) return
      let query = supabase
        .from('events')
        .select('*')
        .eq('household_id', householdId)
        .not('photo_path', 'is', null)
        .order('occurred_at', { ascending: false })
        .limit(PAGE_SIZE)
      if (before) query = query.lt('occurred_at', before)
      const { data } = await query
      const rows = (data ?? []) as DogEvent[]
      setFetched((prev) => (before ? [...prev, ...rows] : rows))
      setHasMore(rows.length === PAGE_SIZE)
      setLoading(false)
    },
    [householdId],
  )

  useEffect(() => {
    load()
  }, [load])

  // Nya foton (via realtid) läggs till direkt. En logg som tagits bort försvinner ur den
  // levande listan; inom den listans tidsspann visas därför bara loggar som finns kvar där.
  const photos = useMemo(() => {
    const liveIds = new Set(liveEvents.map((e) => e.id))
    const oldestLive = liveEvents[liveEvents.length - 1]?.occurred_at
    const byId = new Map<string, DogEvent>()
    for (const e of fetched) {
      if (!oldestLive || e.occurred_at < oldestLive || liveIds.has(e.id)) byId.set(e.id, e)
    }
    for (const e of liveEvents) if (e.photo_path) byId.set(e.id, e)
    return [...byId.values()].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
  }, [fetched, liveEvents])

  const urls = usePhotoUrls(photos.map((p) => p.photo_path!))

  const months = useMemo(() => {
    const groups: { label: string; items: { event: DogEvent; index: number }[] }[] = []
    photos.forEach((event, index) => {
      const label = new Date(event.occurred_at).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
      const last = groups[groups.length - 1]
      if (last?.label === label) last.items.push({ event, index })
      else groups.push({ label, items: [{ event, index }] })
    })
    return groups
  }, [photos, i18n.language])

  if (loading) return <p className="muted center">{t('common.loading')}</p>
  if (!photos.length)
    return (
      <section className="card">
        <h2>{t('photos.title')}</h2>
        <p className="muted">{t('photos.empty')}</p>
      </section>
    )

  const open = openIndex !== null ? photos[openIndex] : null

  return (
    <>
      {months.map((month) => (
        <section className="card" key={month.label}>
          <h2 className="day-title">{month.label}</h2>
          <div className="photo-grid">
            {month.items.map(({ event, index }) => (
              <button
                key={event.id}
                className="photo-tile"
                onClick={() => setOpenIndex(index)}
                aria-label={t('history.showPhoto')}
              >
                {urls[event.photo_path!] ? <img src={urls[event.photo_path!]} alt="" loading="lazy" /> : null}
              </button>
            ))}
          </div>
        </section>
      ))}
      {hasMore && (
        <button className="secondary full" onClick={() => load(fetched[fetched.length - 1]?.occurred_at)}>
          {t('photos.loadMore')}
        </button>
      )}

      {open && openIndex !== null && (
        <PhotoViewer
          url={urls[open.photo_path!]}
          caption={[
            memberName(open.logged_by) ?? t('history.formerMember'),
            `${new Date(open.occurred_at).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })} ${formatTime(open.occurred_at, i18n.language)}`,
          ].join(' · ')}
          position={t('photos.position', { current: openIndex + 1, total: photos.length })}
          onPrev={openIndex > 0 ? () => setOpenIndex(openIndex - 1) : undefined}
          onNext={openIndex < photos.length - 1 ? () => setOpenIndex(openIndex + 1) : undefined}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  )
}

interface ViewerProps {
  url: string | undefined
  // Vem som tog bilden och när.
  caption: string
  position: string
  onPrev?: () => void
  onNext?: () => void
  onClose: () => void
}

function PhotoViewer({ url, caption, position, onPrev, onNext, onClose }: ViewerProps) {
  const { t } = useTranslation()
  const touchStart = useRef<number | null>(null)

  // Svep åt vänster/höger för att bläddra.
  function onTouchEnd(x: number) {
    if (touchStart.current === null) return
    const dx = x - touchStart.current
    touchStart.current = null
    if (dx < -50) onNext?.()
    else if (dx > 50) onPrev?.()
  }

  return (
    <Sheet onClose={onClose}>
      <div
        className="viewer"
        onTouchStart={(e) => (touchStart.current = e.touches[0].clientX)}
        onTouchEnd={(e) => onTouchEnd(e.changedTouches[0].clientX)}
      >
        {url ? <img className="photo-full" src={url} alt="" /> : <div className="photo-full placeholder" />}
        <p className="viewer-caption">{caption}</p>
      </div>
      <div className="viewer-nav">
        <button className="secondary" onClick={onPrev} disabled={!onPrev} aria-label={t('photos.previous')}>
          ‹
        </button>
        <span className="muted small">{position}</span>
        <button className="secondary" onClick={onNext} disabled={!onNext} aria-label={t('photos.next')}>
          ›
        </button>
      </div>
      <p className="muted small center">{t('photos.saveHint')}</p>
      <button className="link" onClick={onClose}>
        {t('common.close')}
      </button>
    </Sheet>
  )
}
