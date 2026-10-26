import { supabase } from './supabase.ts'
import { deleteDogPhoto } from './photos.ts'
import type { DogEvent } from './types.ts'

export async function deleteEvent(event: DogEvent): Promise<boolean> {
  const { error } = await supabase.from('events').delete().eq('id', event.id)
  if (error) return false
  if (event.photo_path) await deleteDogPhoto(event.photo_path)
  return true
}
