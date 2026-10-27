// Loggar som inte kunde skickas (ingen täckning) sparas i telefonen och skickas senare.
// Varje logg har ett id från telefonen, så ett nytt försök kan aldrig ge dubbletter.
import { supabase } from './supabase.ts'
import type { DogEvent } from './types.ts'

const DB_NAME = 'hundappen'
const STORE = 'pending-events'

export type NewEventRow = Omit<DogEvent, 'created_at' | 'pending'>

export interface PendingEvent {
  row: NewEventRow
  photo: Blob | null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'row.id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const queue = {
  add: (item: PendingEvent) => withStore('readwrite', (s) => s.put(item)),
  all: () => withStore<PendingEvent[]>('readonly', (s) => s.getAll()).catch(() => [] as PendingEvent[]),
  remove: (id: string) => withStore('readwrite', (s) => s.delete(id)),
}

// Safari: "Load failed", Chrome: "Failed to fetch".
export function isNetworkError(error: unknown): boolean {
  if (!navigator.onLine) return true
  const message = String((error as { message?: string })?.message ?? error)
  return /failed to fetch|load failed|network|fetch/i.test(message)
}

// Laddar upp fotot (om något) och sparar loggen. Kastar fel om det inte gick.
export async function submitEvent({ row, photo }: PendingEvent): Promise<DogEvent> {
  if (photo && row.photo_path) {
    const { error } = await supabase.storage
      .from('dog-photos')
      .upload(row.photo_path, photo, { contentType: 'image/jpeg', upsert: true })
    if (error) throw error
  }
  const { data, error } = await supabase.from('events').insert(row).select().single()
  if (error) {
    // Redan sparad vid ett tidigare försök (svaret nådde aldrig fram).
    if (error.code === '23505') {
      const { data: existing } = await supabase.from('events').select('*').eq('id', row.id).single()
      if (existing) return existing as DogEvent
    }
    throw error
  }
  return data as DogEvent
}
