import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase.ts'
import { useHousehold } from './HouseholdProvider.tsx'
import type { Schedule } from '../lib/types.ts'

interface SchedulesState {
  loading: boolean
  schedules: Schedule[]
  reload: () => Promise<void>
}

const SchedulesContext = createContext<SchedulesState | null>(null)

export function SchedulesProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold()
  const householdId = household?.id
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!householdId) return
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('household_id', householdId)
      .order('local_time')
    if (data) setSchedules(data as Schedule[])
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    reload()
    // Någon annan kan ha ändrat schemat medan appen låg i bakgrunden.
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  return <SchedulesContext.Provider value={{ loading, schedules, reload }}>{children}</SchedulesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSchedules(): SchedulesState {
  const ctx = useContext(SchedulesContext)
  if (!ctx) throw new Error('useSchedules måste användas inuti SchedulesProvider')
  return ctx
}
