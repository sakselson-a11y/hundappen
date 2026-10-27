import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase.ts'
import { useHousehold } from './HouseholdProvider.tsx'
import type { DogEvent } from '../lib/types.ts'
import { isNetworkError, queue, submitEvent, type PendingEvent } from '../lib/offlineQueue.ts'

const PAGE_SIZE = 50

interface EventsState {
  loading: boolean
  events: DogEvent[]
  hasMore: boolean
  loadMore: () => Promise<void>
  addLocal: (event: DogEvent) => void
  removeLocal: (id: string) => void
  // Sparar en ny logg; utan nät läggs den i kö och skickas senare.
  logEvent: (item: PendingEvent) => Promise<'saved' | 'queued'>
  removePending: (id: string) => Promise<void>
}

const EventsContext = createContext<EventsState | null>(null)

function sortDesc(list: DogEvent[]): DogEvent[] {
  return [...list].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
}

function upsert(list: DogEvent[], event: DogEvent): DogEvent[] {
  return sortDesc([...list.filter((e) => e.id !== event.id), event])
}

// Håller hushållets loggar och uppdaterar dem i realtid.
export function EventsProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold()
  const householdId = household?.id
  const [events, setEvents] = useState<DogEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [pending, setPending] = useState<DogEvent[]>([])
  const eventsRef = useRef(events)
  eventsRef.current = events
  const flushing = useRef(false)

  const fetchLatest = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('household_id', householdId)
      .order('occurred_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (!error && data) {
      // Behåll äldre sidor som redan laddats.
      setEvents((prev) => {
        const oldest = data.length ? data[data.length - 1].occurred_at : null
        const older = oldest ? prev.filter((e) => e.occurred_at < oldest) : []
        return sortDesc([...(data as DogEvent[]), ...older])
      })
      if (eventsRef.current.length <= PAGE_SIZE) setHasMore(data.length === PAGE_SIZE)
    }
    setLoading(false)
  }, [householdId])

  const loadMore = useCallback(async () => {
    if (!householdId) return
    const oldest = eventsRef.current[eventsRef.current.length - 1]?.occurred_at
    if (!oldest) return
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('household_id', householdId)
      .lt('occurred_at', oldest)
      .order('occurred_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (data) {
      setEvents((prev) => sortDesc([...prev, ...(data as DogEvent[]).filter((e) => !prev.some((p) => p.id === e.id))]))
      setHasMore(data.length === PAGE_SIZE)
    }
  }, [householdId])

  useEffect(() => {
    if (!householdId) return
    setLoading(true)
    fetchLatest()

    const channel = supabase
      .channel(`events-${householdId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', filter: `household_id=eq.${householdId}` },
        (payload) => setEvents((prev) => upsert(prev, payload.new as DogEvent)),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events', filter: `household_id=eq.${householdId}` },
        (payload) => setEvents((prev) => upsert(prev, payload.new as DogEvent)),
      )
      // DELETE går inte att filtrera; vi tar bara bort id:n vi redan har.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'events' }, (payload) => {
        const id = (payload.old as { id?: string }).id
        if (id) setEvents((prev) => prev.filter((e) => e.id !== id))
      })
      .subscribe()

    // iPhone pausar appen i bakgrunden; hämta det senaste när den visas igen.
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchLatest()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [householdId, fetchLatest])

  const addLocal = useCallback((event: DogEvent) => setEvents((prev) => upsert(prev, event)), [])
  const removeLocal = useCallback((id: string) => setEvents((prev) => prev.filter((e) => e.id !== id)), [])

  const asPending = (item: PendingEvent): DogEvent => ({
    ...item.row,
    // Fotot finns bara i telefonen än så länge.
    photo_path: null,
    created_at: new Date().toISOString(),
    pending: true,
  })

  // Försök skicka allt som väntar. Stannar vid första nätverksfelet.
  const flush = useCallback(async () => {
    if (flushing.current || !householdId) return
    flushing.current = true
    try {
      const items = (await queue.all()).filter((i) => i.row.household_id === householdId)
      setPending(items.map(asPending))
      for (const item of items) {
        try {
          const saved = await submitEvent(item)
          await queue.remove(item.row.id)
          setPending((prev) => prev.filter((e) => e.id !== item.row.id))
          setEvents((prev) => upsert(prev, saved))
        } catch (err) {
          if (isNetworkError(err)) break
          // Kan inte sparas alls (t.ex. har man lämnat hushållet): ta bort ur kön.
          console.error('Väntande logg kunde inte sparas', err)
          await queue.remove(item.row.id)
          setPending((prev) => prev.filter((e) => e.id !== item.row.id))
        }
      }
    } finally {
      flushing.current = false
    }
  }, [householdId])

  useEffect(() => {
    flush()
    const onOnline = () => flush()
    const onVisible = () => document.visibilityState === 'visible' && flush()
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [flush])

  // Försök igen var 30:e sekund så länge något väntar.
  useEffect(() => {
    if (!pending.length) return
    const id = setInterval(flush, 30000)
    return () => clearInterval(id)
  }, [pending.length, flush])

  const logEvent = useCallback(async (item: PendingEvent): Promise<'saved' | 'queued'> => {
    try {
      const saved = await submitEvent(item)
      setEvents((prev) => upsert(prev, saved))
      return 'saved'
    } catch (err) {
      if (!isNetworkError(err)) throw err
      await queue.add(item)
      setPending((prev) => [asPending(item), ...prev.filter((e) => e.id !== item.row.id)])
      return 'queued'
    }
  }, [])

  const removePending = useCallback(async (id: string) => {
    await queue.remove(id)
    setPending((prev) => prev.filter((e) => e.id !== id))
  }, [])

  // Väntande loggar visas tillsammans med de sparade.
  const allEvents = useMemo(() => {
    const ids = new Set(pending.map((e) => e.id))
    return sortDesc([...pending, ...events.filter((e) => !ids.has(e.id))])
  }, [pending, events])

  return (
    <EventsContext.Provider
      value={{ loading, events: allEvents, hasMore, loadMore, addLocal, removeLocal, logEvent, removePending }}
    >
      {children}
    </EventsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEvents(): EventsState {
  const ctx = useContext(EventsContext)
  if (!ctx) throw new Error('useEvents måste användas inuti EventsProvider')
  return ctx
}
