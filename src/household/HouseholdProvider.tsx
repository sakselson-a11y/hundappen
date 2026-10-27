import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import type { Dog, Household, Member, MemberPrefs, MemberRole } from '../lib/types.ts'

interface HouseholdState {
  loading: boolean
  error: boolean
  household: Household | null
  role: MemberRole | null
  dogs: Dog[]
  members: Member[]
  myPrefs: MemberPrefs | null
  // Hundvakt: när ens eget medlemskap går ut.
  myExpiresAt: string | null
  memberName: (userId: string | null) => string | null
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
  const [members, setMembers] = useState<Member[]>([])
  const [myPrefs, setMyPrefs] = useState<MemberPrefs | null>(null)
  const [myExpiresAt, setMyExpiresAt] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!userId) return
    setError(false)
    // Version 1: en användare tillhör högst ett hushåll.
    const { data: membership, error: memberError } = await supabase
      .from('household_members')
      .select('role, notify_events, notify_reminders, expires_at, household:households(*)')
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
    setMyExpiresAt(membership?.expires_at ?? null)
    setMyPrefs(
      membership
        ? { notify_events: membership.notify_events, notify_reminders: membership.notify_reminders as MemberPrefs['notify_reminders'] }
        : null,
    )

    if (hh) {
      const [dogResult, memberResult] = await Promise.all([
        supabase.from('dogs').select('*').eq('household_id', hh.id).is('archived_at', null).order('created_at'),
        supabase
          .from('household_members')
          .select('user_id, household_id, role, expires_at, profile:profiles(display_name)')
          .eq('household_id', hh.id)
          .order('joined_at'),
      ])
      if (dogResult.error || memberResult.error) setError(true)
      setDogs((dogResult.data ?? []) as Dog[])
      const rows = (memberResult.data ?? []) as unknown as {
        user_id: string
        household_id: string
        role: MemberRole
        expires_at: string | null
        profile: { display_name: string | null } | null
      }[]
      const now = new Date().toISOString()
      setMembers(
        rows
          // Hundvakter vars tid gått ut (städas bort på natten).
          .filter((m) => !m.expires_at || m.expires_at > now)
          .map((m) => ({
            user_id: m.user_id,
            household_id: m.household_id,
            role: m.role,
            expires_at: m.expires_at,
            display_name: m.profile?.display_name ?? null,
          })),
      )
    } else {
      setDogs([])
      setMembers([])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    setLoading(true)
    reload()
  }, [reload])

  const memberName = useCallback(
    (id: string | null) => members.find((m) => m.user_id === id)?.display_name ?? null,
    [members],
  )

  return (
    <HouseholdContext.Provider value={{ loading, error, household, role, dogs, members, myPrefs, myExpiresAt, memberName, reload }}>
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
