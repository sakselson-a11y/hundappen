import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase.ts'
import { useHousehold } from './HouseholdProvider.tsx'
import type { Schedule, ScheduleOverride } from '../lib/types.ts'
import { useAuth } from '../auth/AuthProvider.tsx'

interface SchedulesState {
  loading: boolean
  schedules: Schedule[]
  overrides: ScheduleOverride[]
  setOverride: (scheduleId: string, date: string, responsible: string | null) => Promise<void>
  clearOverride: (scheduleId: string, date: string) => Promise<void>
  reload: () => Promise<void>
}

const SchedulesContext = createContext<SchedulesState | null>(null)

export function SchedulesProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold()
  const householdId = household?.id
  const { session } = useAuth()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!householdId) return
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('household_id', householdId)
      .order('local_time')
    if (data) setSchedules(data as Schedule[])
    // Byten från igår och framåt (räcker för "Idag").
    const since = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const { data: o } = await supabase
      .from('schedule_overrides')
      .select('schedule_id, occurrence_date, household_id, responsible_user_id, changed_by')
      .eq('household_id', householdId)
      .gte('occurrence_date', since)
    if (o) setOverrides(o as ScheduleOverride[])
    setLoading(false)
  }, [householdId])

  const setOverride = useCallback(
    async (scheduleId: string, date: string, responsible: string | null) => {
      if (!householdId || !session) return
      const { error } = await supabase.from('schedule_overrides').upsert(
        {
          schedule_id: scheduleId,
          occurrence_date: date,
          household_id: householdId,
          responsible_user_id: responsible,
          changed_by: session.user.id,
        },
        { onConflict: 'schedule_id,occurrence_date' },
      )
      if (error) throw error
      await reload()
    },
    [householdId, session, reload],
  )

  const clearOverride = useCallback(
    async (scheduleId: string, date: string) => {
      const { error } = await supabase
        .from('schedule_overrides')
        .delete()
        .eq('schedule_id', scheduleId)
        .eq('occurrence_date', date)
      if (error) throw error
      await reload()
    },
    [reload],
  )

  useEffect(() => {
    reload()
    // Någon annan kan ha ändrat schemat medan appen låg i bakgrunden.
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  return <SchedulesContext.Provider value={{ loading, schedules, overrides, setOverride, clearOverride, reload }}>{children}</SchedulesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSchedules(): SchedulesState {
  const ctx = useContext(SchedulesContext)
  if (!ctx) throw new Error('useSchedules måste användas inuti SchedulesProvider')
  return ctx
}
