import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import type { Dog, Household, MemberRole } from '../lib/types.ts'

interface HouseholdState {
  loading: boolean
  error: boolean
  household: Household | null
  role: MemberRole | null
  dogs: Dog[]
  reload: () => Promise<void>
}

const HouseholdContext = createContext<HouseholdState | null>(null)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [household, setHousehold] = useState<Household | null>(null)
  const [role, setRole] = useState<MemberRole | null>(null)
  const [dogs, setDogs] = useState<Dog[]>([])

  const reload = useCallback(async () => {
    if (!userId) return
    setError(false)
    // Version 1: en användare tillhör högst ett hushåll.
    const { data: membership, error: memberError } = await supabase
      .from('household_members')
      .select('role, household:households(*)')
      .eq('user_id', userId)
      .order('joined_at')
      .limit(1)
      .maybeSingle()
    if (memberError) {
      setError(true)
      setLoading(false)
      return
    }
    const hh = (membership?.household ?? null) as unknown as Household | null
    setHousehold(hh)
    setRole((membership?.role as MemberRole) ?? null)

    if (hh) {
      const { data: dogRows, error: dogError } = await supabase
        .from('dogs')
        .select('*')
        .eq('household_id', hh.id)
        .is('archived_at', null)
        .order('created_at')
      if (dogError) setError(true)
      setDogs((dogRows ?? []) as Dog[])
    } else {
      setDogs([])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    setLoading(true)
    reload()
  }, [reload])

  return (
    <HouseholdContext.Provider value={{ loading, error, household, role, dogs, reload }}>
      {children}
    </HouseholdContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHousehold(): HouseholdState {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold måste användas inuti HouseholdProvider')
  return ctx
}
