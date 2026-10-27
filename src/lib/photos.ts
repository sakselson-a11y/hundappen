import { useEffect, useState } from 'react'
import { supabase } from './supabase.ts'

const BUCKET = 'dog-photos'
const MAX_SIZE = 1024

// Skalar ner bilden i telefonen innan uppladdning (sparar tid och lagring).
export async function resizeImage(file: File, maxSize = MAX_SIZE): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', 0.85),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function uploadDogPhoto(householdId: string, dogId: string, image: Blob): Promise<string> {
  const path = `${householdId}/${dogId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, image, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

// Ny sökväg för varje foto, så att ett utbytt foto aldrig visas från en gammal adress.
export function eventPhotoPath(householdId: string, eventId: string): string {
  return `${householdId}/events/${eventId}-${crypto.randomUUID().slice(0, 8)}.jpg`
}

export async function uploadEventPhoto(householdId: string, eventId: string, image: Blob): Promise<string> {
  const path = eventPhotoPath(householdId, eventId)
  const { error } = await supabase.storage.from(BUCKET).upload(path, image, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

export async function deleteDogPhoto(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}

// Fotona är privata, så de visas via tillfälliga signerade adresser (giltiga en timme).
// Adresserna sparas en stund så att samma foto inte behöver hämtas igen.
const URL_TTL_SECONDS = 60 * 60
const cache = new Map<string, { url: string; expires: number }>()

function cached(path: string): string | null {
  const hit = cache.get(path)
  return hit && hit.expires > Date.now() ? hit.url : null
}

async function signUrls(paths: string[]): Promise<void> {
  const missing = [...new Set(paths)].filter((p) => !cached(p))
  for (let i = 0; i < missing.length; i += 100) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(missing.slice(i, i + 100), URL_TTL_SECONDS)
    // Lite marginal så att en adress inte hinner gå ut medan bilden visas.
    const expires = Date.now() + (URL_TTL_SECONDS - 300) * 1000
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) cache.set(item.path, { url: item.signedUrl, expires })
    }
  }
}

// Adresser för många foton på en gång (t.ex. bildrutnätet).
export function usePhotoUrls(paths: string[]): Record<string, string> {
  const key = paths.join('|')
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    const list = key ? key.split('|') : []
    signUrls(list).then(() => {
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const p of list) {
        const url = cached(p)
        if (url) next[p] = url
      }
      setUrls(next)
    })
    return () => {
      cancelled = true
    }
  }, [key])
  return urls
}

export function usePhotoUrl(path: string | null): string | null {
  const urls = usePhotoUrls(path ? [path] : [])
  return path ? (urls[path] ?? cached(path)) : null
}
