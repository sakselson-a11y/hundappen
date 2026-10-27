import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import { useSchedules } from '../household/SchedulesProvider.tsx'
import { activityLabel } from '../lib/labels.ts'
import { formatTime } from '../lib/time.ts'
import Sheet from './Sheet.tsx'
import type { Occurrence } from '../lib/schedule.ts'

interface Props {
  occurrence: Occurrence
  dateKey: string // YYYY-MM-DD i hushållets tidszon
  currentResponsible: string | null
  overridden: boolean
  onClose: () => void
}

// "Vem tar 18:00 lång promenad idag?" – byter tur bara för det här tillfället.
export default function SwapSheet({ occurrence, dateKey, currentResponsible, overridden, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const { session } = useAuth()
  const { members, memberName } = useHousehold()
  const { setOverride, clearOverride } = useSchedules()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const me = session?.user.id ?? null
  const scheduled = occurrence.schedule.responsible_user_id
  const what = `${activityLabel(t, occurrence.schedule.type, occurrence.schedule.walk_length, false).toLowerCase()} ${formatTime(occurrence.at.toISOString(), i18n.language)}`

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onClose()
    } catch {
      setError(t('errors.generic'))
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <h2>{t('swap.title', { what })}</h2>
      <p className="muted">
        {!currentResponsible
          ? t('swap.currentNobody')
          : currentResponsible === me
            ? t('swap.currentYou')
            : t('swap.current', { name: memberName(currentResponsible) })}
      </p>
      {currentResponsible !== me && (
        <button className="primary" disabled={busy} onClick={() => run(() => setOverride(occurrence.schedule.id, dateKey, me))}>
          🙋 {t('swap.illTakeIt')}
        </button>
      )}
      <div className="swap-list">
        {members
          .filter((m) => m.user_id !== me && m.user_id !== currentResponsible)
          .map((m) => (
            <button
              key={m.user_id}
              className="secondary"
              disabled={busy}
              onClick={() => run(() => setOverride(occurrence.schedule.id, dateKey, m.user_id))}
            >
              {t('swap.giveTo', { name: m.display_name ?? t('family.unnamed') })}
            </button>
          ))}
      </div>
      {overridden && (
        <button className="link" disabled={busy} onClick={() => run(() => clearOverride(occurrence.schedule.id, dateKey))}>
          {scheduled ? t('swap.reset', { name: memberName(scheduled) }) : t('swap.resetNobody')}
        </button>
      )}
      <p className="muted small">{t('swap.help')}</p>
      {error && <p className="error">{error}</p>}
      <button className="link" onClick={onClose} disabled={busy}>
        {t('common.cancel')}
      </button>
    </Sheet>
  )
}
