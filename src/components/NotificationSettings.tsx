import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.ts'
import { enablePush, sendTestPush, usePushStatus } from '../lib/push.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import type { ReminderPref } from '../lib/types.ts'

export default function NotificationSettings({ dogName }: { dogName: string }) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { household, myPrefs, reload } = useHousehold()
  const [status, setStatus] = usePushStatus()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  async function enable() {
    setBusy(true)
    setMessage(null)
    try {
      setStatus(await enablePush())
    } catch {
      setMessage({ text: t('notifications.enableFailed'), error: true })
    }
    setBusy(false)
  }

  async function test() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await sendTestPush()
      setMessage(
        result.sent > 0
          ? { text: t('notifications.testSent', { count: result.sent }) }
          : { text: t('notifications.testNoDevices'), error: true },
      )
    } catch {
      setMessage({ text: t('errors.generic'), error: true })
    }
    setBusy(false)
  }

  async function savePrefs(changes: { notify_events?: boolean; notify_reminders?: ReminderPref }) {
    if (!household || !session) return
    await supabase
      .from('household_members')
      .update(changes)
      .eq('household_id', household.id)
      .eq('user_id', session.user.id)
    await reload()
  }

  const statusText: Record<string, string> = {
    loading: t('common.loading'),
    'needs-install': t('notifications.statusNeedsInstall'),
    unsupported: t('notifications.statusUnsupported'),
    off: t('notifications.statusOff'),
    denied: t('notifications.statusDenied'),
    on: t('notifications.statusOn'),
  }

  return (
    <section className="card form">
      <h2>{t('notifications.title')}</h2>
      <div className="setting-row">
        <span>{t('notifications.thisDevice')}</span>
        <span className={status === 'on' ? 'success' : 'muted'}>{statusText[status]}</span>
      </div>
      {status === 'off' && (
        <button className="primary" onClick={enable} disabled={busy}>
          {t('notifications.enable')}
        </button>
      )}
      {status === 'denied' && <p className="muted small">{t('notifications.deniedHelp')}</p>}
      {status === 'on' && (
        <button className="secondary" onClick={test} disabled={busy}>
          {busy ? t('common.wait') : t('notifications.sendTest')}
        </button>
      )}
      {message && <p className={message.error ? 'error' : 'success'}>{message.text}</p>}

      {myPrefs && (
        <>
          <label className="toggle-row">
            <span>{t('notifications.eventsLabel', { dog: dogName })}</span>
            <input
              type="checkbox"
              role="switch"
              // Ger iPhones egen brytare (iOS 17.4+); andra visar en kryssruta.
              {...{ switch: '' }}
              checked={myPrefs.notify_events}
              onChange={(e) => savePrefs({ notify_events: e.target.checked })}
            />
          </label>
          <label>
            <span>{t('notifications.remindersLabel')}</span>
            <select
              value={myPrefs.notify_reminders}
              onChange={(e) => savePrefs({ notify_reminders: e.target.value as ReminderPref })}
            >
              <option value="all">{t('notifications.remindersAll')}</option>
              <option value="mine">{t('notifications.remindersMine')}</option>
              <option value="none">{t('notifications.remindersNone')}</option>
            </select>
          </label>
        </>
      )}
    </section>
  )
}
