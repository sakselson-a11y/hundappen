import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import { useSchedules } from '../household/SchedulesProvider.tsx'
import { daysText } from '../lib/scheduleText.ts'
import ScheduleSheet from '../components/ScheduleSheet.tsx'
import { activityLabel } from '../lib/labels.ts'
import type { Dog, Schedule } from '../lib/types.ts'

export default function ScheduleScreen({ dog }: { dog: Dog }) {
  const { t } = useTranslation()
  const { household, memberName } = useHousehold()
  const { schedules, loading } = useSchedules()
  const [editing, setEditing] = useState<Schedule | 'new' | null>(null)
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const householdZone = household?.time_zone ?? deviceZone

  return (
    <>
      <section className="card">
        <h2>{t('schedule.title', { dog: dog.name })}</h2>
        {loading ? (
          <p className="muted">{t('common.loading')}</p>
        ) : !schedules.length ? (
          <p className="muted">{t('schedule.empty')}</p>
        ) : (
          <ul className="schedule-list">
            {schedules.map((s) => {
              const who = s.responsible_user_id ? memberName(s.responsible_user_id) : null
              return (
                <li key={s.id}>
                  <button className={`schedule-row ${s.active ? '' : 'inactive'}`} onClick={() => setEditing(s)}>
                    <span className="schedule-time">{s.local_time.slice(0, 5)}</span>
                    <span className="schedule-info">
                      <strong>
                        {activityLabel(t, s.type, s.walk_length)}
                        {!s.active && <span className="tag">{t('schedule.paused')}</span>}
                      </strong>
                      <span className="muted small">
                        {daysText(t, s.days_of_week)}
                        {who && ` · ${t('schedule.turnOf', { name: who })}`}
                        {s.remind_minutes_before ? ` · 🔔 ${t('schedule.minutesBefore', { count: s.remind_minutes_before })}` : ''}
                      </span>
                    </span>
                    <span className="chevron" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <button className="primary full" onClick={() => setEditing('new')}>
          + {t('schedule.add')}
        </button>
        {householdZone !== deviceZone && (
          <p className="muted small">{t('schedule.zoneNote', { zone: householdZone })}</p>
        )}
      </section>
      {editing && (
        <ScheduleSheet dog={dog} schedule={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
