import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.ts'
import { deleteDogPhoto, usePhotoUrls } from '../lib/photos.ts'
import { formatTime } from '../lib/time.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import { useEvents } from '../household/EventsProvider.tsx'
import Sheet from '../components/Sheet.tsx'
import type { Dog, DogEvent } from '../lib/types.ts'

const PAGE_SIZE = 60

type Item = { kind: 'dog'; path: string; dog: Dog } | { kind: 'event'; path: string; event: DogEvent }

// Hundens profilbild och alla foton från loggarna (nyast först, per månad).
export default function PhotosScreen() {
  const { t, i18n } = useTranslation()
  const { session } = useAuth()
  const { household, dogs, role, memberName, reload: reloadHousehold } = useHousehold()
  const { events: liveEvents, addLocal } = useEvents()
  const [fetched, setFetched] = useState<DogEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const householdId = household?.id
  const dog = dogs[0]

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

  // Nya foton (via realtid) läggs till direkt. Inom den levande listans tidsspann visas bara
  // loggar som finns kvar där och fortfarande har foto (borttagna loggar och bilder försvinner).
  const eventPhotos = useMemo(() => {
    const liveById = new Map(liveEvents.map((e) => [e.id, e]))
    const oldestLive = liveEvents[liveEvents.length - 1]?.occurred_at
    const byId = new Map<string, DogEvent>()
    for (const e of fetched) {
      if (!oldestLive || e.occurred_at < oldestLive || liveById.has(e.id)) byId.set(e.id, e)
    }
    for (const e of liveEvents) {
      if (e.photo_path) byId.set(e.id, e)
      else byId.delete(e.id)
    }
    return [...byId.values()].filter((e) => e.photo_path).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
  }, [fetched, liveEvents])

  const items: Item[] = useMemo(
    () => [
      ...(dog?.photo_path ? [{ kind: 'dog' as const, path: dog.photo_path, dog }] : []),
      ...eventPhotos.map((event) => ({ kind: 'event' as const, path: event.photo_path!, event })),
    ],
    [dog, eventPhotos],
  )

  const urls = usePhotoUrls(items.map((i) => i.path))

  const months = useMemo(() => {
    const groups: { label: string; items: { item: Item; index: number }[] }[] = []
    items.forEach((item, index) => {
      if (item.kind !== 'event') return
      const label = new Date(item.event.occurred_at).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
      const last = groups[groups.length - 1]
      if (last?.label === label) last.items.push({ item, index })
      else groups.push({ label, items: [{ item, index }] })
    })
    return groups
  }, [items, i18n.language])

  function canDelete(item: Item): boolean {
    if (item.kind === 'dog') return true
    return item.event.logged_by === session?.user.id || role === 'owner'
  }

  async function remove(item: Item) {
    if (!window.confirm(item.kind === 'dog' ? t('photos.confirmDeleteProfile', { dog: item.dog.name }) : t('photos.confirmDelete'))) {
      return
    }
    setBusy(true)
    try {
      if (item.kind === 'dog') {
        const { error } = await supabase.from('dogs').update({ photo_path: null }).eq('id', item.dog.id)
        if (error) throw error
        await deleteDogPhoto(item.path)
        await reloadHousehold()
      } else {
        const { data: path, error } = await supabase.rpc('remove_event_photo', { event_id: item.event.id })
        if (error) throw error
        if (path) await deleteDogPhoto(path as string)
        setFetched((prev) => prev.filter((e) => e.id !== item.event.id))
        addLocal({ ...item.event, photo_path: null })
      }
      // Visa nästa bild (eller stäng om det var den sista).
      setOpenIndex((i) => (i === null || items.length <= 1 ? null : Math.min(i, items.length - 2)))
    } catch {
      window.alert(t('errors.generic'))
    }
    setBusy(false)
  }

  if (loading) return <p className="muted center">{t('common.loading')}</p>
  if (!items.length)
    return (
      <section className="card">
        <h2>{t('photos.title')}</h2>
        <p className="muted">{t('photos.empty')}</p>
      </section>
    )

  const open = openIndex !== null ? items[openIndex] : null
  const tile = (item: Item, index: number) => (
    <button
      key={item.kind === 'dog' ? 'dog' : item.event.id}
      className="photo-tile"
      onClick={() => setOpenIndex(index)}
      aria-label={t('history.showPhoto')}
    >
      {urls[item.path] ? <img src={urls[item.path]} alt="" loading="lazy" /> : null}
    </button>
  )

  return (
    <>
      {items[0]?.kind === 'dog' && (
        <section className="card">
          <h2>{t('photos.profileTitle', { dog: items[0].dog.name })}</h2>
          <div className="photo-grid">{tile(items[0], 0)}</div>
        </section>
      )}
      {months.map((month) => (
        <section className="card" key={month.label}>
          <h2 className="day-title">{month.label}</h2>
          <div className="photo-grid">{month.items.map(({ item, index }) => tile(item, index))}</div>
        </section>
      ))}
      {hasMore && (
        <button className="secondary full" onClick={() => load(fetched[fetched.length - 1]?.occurred_at)}>
          {t('photos.loadMore')}
        </button>
      )}

      {open && openIndex !== null && (
        <PhotoViewer
          url={urls[open.path]}
          caption={
            open.kind === 'dog'
              ? t('photos.profileCaption', { dog: open.dog.name })
              : [
                  memberName(open.event.logged_by) ?? t('history.formerMember'),
                  `${new Date(open.event.occurred_at).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })} ${formatTime(open.event.occurred_at, i18n.language)}`,
                ].join(' · ')
          }
          position={t('photos.position', { current: openIndex + 1, total: items.length })}
          onPrev={openIndex > 0 ? () => setOpenIndex(openIndex - 1) : undefined}
          onNext={openIndex < items.length - 1 ? () => setOpenIndex(openIndex + 1) : undefined}
          onDelete={canDelete(open) ? () => remove(open) : undefined}
          busy={busy}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  )
}

interface ViewerProps {
  url: string | undefined
  // Vem som tog bilden och när (eller "Tuccis profilbild").
  caption: string
  position: string
  onPrev?: () => void
  onNext?: () => void
  onDelete?: () => void
  busy: boolean
  onClose: () => void
}

function PhotoViewer({ url, caption, position, onPrev, onNext, onDelete, busy, onClose }: ViewerProps) {
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
      <div className="row">
        {onDelete ? (
          <button className="link danger" onClick={onDelete} disabled={busy}>
            {busy ? t('common.wait') : t('photos.delete')}
          </button>
        ) : (
          <span />
        )}
        <button className="link" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </Sheet>
  )
}
