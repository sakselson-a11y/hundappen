import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase.ts'
import { useHousehold } from './HouseholdProvider.tsx'
import type { DogEvent } from '../lib/types.ts'

const PAGE_SIZE = 50

interface EventsState {
  loading: boolean
  events: DogEvent[]
  hasMore: boolean
  loadMore: () => Promise<void>
  addLocal: (event: DogEvent) => void
  removeLocal: (id: string) => void
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
  const eventsRef = useRef(events)
  eventsRef.current = events

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

  return (
    <EventsContext.Provider value={{ loading, events, hasMore, loadMore, addLocal, removeLocal }}>
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
