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

export async function deleteDogPhoto(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}

// Fotona är privata, så de visas via en tillfällig signerad adress.
export function usePhotoUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!path) {
      setUrl(null)
      return
    }
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [path])
  return url
}
