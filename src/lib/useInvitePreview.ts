import { useEffect, useState } from 'react'
import { supabase } from './supabase.ts'
import { normalizeCode } from './invite.ts'

export interface InvitePreview {
  dogName: string | null
  inviterName: string | null
}

// Hämtar "Sven bjuder in dig till Tucci" för en kod. null = ogiltig eller ej hämtad.
export function useInvitePreview(code: string | null): InvitePreview | null {
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  useEffect(() => {
    let cancelled = false
    setPreview(null)
    if (!code || normalizeCode(code).length !== 8) return
    supabase.rpc('invite_preview', { invite_code: code }).then(({ data }) => {
      const row = (data as { dog_name: string | null; inviter_name: string | null }[] | null)?.[0]
      if (!cancelled && row) setPreview({ dogName: row.dog_name, inviterName: row.inviter_name })
    })
    return () => {
      cancelled = true
    }
  }, [code])
  return preview
}
