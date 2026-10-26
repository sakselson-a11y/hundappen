import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import { useSchedules } from '../household/SchedulesProvider.tsx'
import { dayShort } from '../lib/scheduleText.ts'
import Sheet from './Sheet.tsx'
import type { Dog, EventType, Schedule } from '../lib/types.ts'

const REMIND_OPTIONS = [0, 5, 10, 15, 30, 60]
const SKIP_OPTIONS = [30, 60, 90, 120]
const PRESETS: Record<string, number[]> = {
  everyDay: [1, 2, 3, 4, 5, 6, 7],
  weekdays: [1, 2, 3, 4, 5],
  weekends: [6, 7],
}

interface Props {
  dog: Dog
  schedule?: Schedule
  onClose: () => void
}

export default function ScheduleSheet({ dog, schedule, onClose }: Props) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { members } = useHousehold()
  const { reload } = useSchedules()
  const [type, setType] = useState<EventType>(schedule?.type ?? 'walk')
  const [time, setTime] = useState(schedule?.local_time.slice(0, 5) ?? '07:00')
  const [days, setDays] = useState<number[]>(schedule?.days_of_week ?? PRESETS.everyDay)
  const [responsible, setResponsible] = useState(schedule?.responsible_user_id ?? '')
  const [remind, setRemind] = useState(schedule?.remind_minutes_before ?? 15)
  const [skip, setSkip] = useState(schedule?.skip_window_minutes ?? 60)
  const [active, setActive] = useState(schedule?.active ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!days.length) {
      setError(t('schedule.noDays'))
      return
    }
    setBusy(true)
    setError(null)
    const row = {
      type,
      local_time: time,
      days_of_week: days,
      responsible_user_id: responsible || null,
      remind_minutes_before: remind || null,
      skip_window_minutes: skip,
      active,
    }
    const { error } = schedule
      ? await supabase.from('schedules').update(row).eq('id', schedule.id)
      : await supabase
          .from('schedules')
          .insert({ ...row, household_id: dog.household_id, dog_id: dog.id, created_by: session?.user.id })
    if (error) {
      setError(t('errors.generic'))
      setBusy(false)
      return
    }
    await reload()
    onClose()
  }

  async function remove() {
    if (!schedule || !window.confirm(t('schedule.confirmDelete'))) return
    setBusy(true)
    await supabase.from('schedules').delete().eq('id', schedule.id)
    await reload()
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <form className="form" onSubmit={save}>
        <h2>{schedule ? t('schedule.editTitle') : t('schedule.addTitle')}</h2>

        <div className="segmented" role="radiogroup">
          {(['walk', 'meal'] as const).map((tp) => (
            <button
              key={tp}
              type="button"
              role="radio"
              aria-checked={type === tp}
              className={type === tp ? 'on' : ''}
              onClick={() => setType(tp)}
            >
              {tp === 'walk' ? `🦮 ${t('overview.logWalk')}` : `🍖 ${t('overview.logMeal')}`}
            </button>
          ))}
        </div>

        <label>
          <span>{t('schedule.time')}</span>
          <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
        </label>

        <div className="field">
          <span className="field-label">{t('schedule.daysLabel')}</span>
          <div className="day-picker">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                className={days.includes(d) ? 'on' : ''}
                onClick={() => toggleDay(d)}
              >
                {dayShort(t, d)}
              </button>
            ))}
          </div>
          <div className="row presets">
            {Object.entries(PRESETS).map(([key, value]) => (
              <button key={key} type="button" className="link small" onClick={() => setDays(value)}>
                {t(`schedule.days.${key}`)}
              </button>
            ))}
          </div>
        </div>

        <label>
          <span>{t('schedule.responsible')}</span>
          <select value={responsible} onChange={(e) => setResponsible(e.target.value)}>
            <option value="">{t('schedule.nobody')}</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name ?? t('family.unnamed')}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{t('schedule.remind')}</span>
          <select value={remind} onChange={(e) => setRemind(Number(e.target.value))}>
            {REMIND_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? t('schedule.noReminder') : t('schedule.minutesBefore', { count: m })}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{t('schedule.skip')}</span>
          <select value={skip} onChange={(e) => setSkip(Number(e.target.value))}>
            {SKIP_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {t('schedule.skipOption', { count: m })}
              </option>
            ))}
          </select>
          <em className="optional">{t('schedule.skipHelp', { dog: dog.name })}</em>
        </label>

        {schedule && (
          <label className="toggle-row">
            <span>{t('schedule.active')}</span>
            <input type="checkbox" role="switch" {...{ switch: '' }} checked={active} onChange={(e) => setActive(e.target.checked)} />
          </label>
        )}

        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? t('common.wait') : t('common.save')}
        </button>
        {schedule && (
          <button type="button" className="link danger" onClick={remove} disabled={busy}>
            {t('schedule.delete')}
          </button>
        )}
        <button type="button" className="link" onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </button>
      </form>
    </Sheet>
  )
}
