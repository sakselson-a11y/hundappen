import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { enablePush, usePushStatus } from '../lib/push.ts'
import InstallSteps from './InstallSteps.tsx'
import { isIOS } from '../pwa.ts'

// Uppmaning på översikten att slå på notiser (eller installera appen först).
export default function NotificationsCard() {
  const { t } = useTranslation()
  const [status, setStatus] = usePushStatus()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('hundappen.installHintDismissed') === '1'
    } catch {
      return false
    }
  })

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      setStatus(await enablePush())
    } catch {
      setError(t('notifications.enableFailed'))
    }
    setBusy(false)
  }

  if (status === 'needs-install' && !dismissed)
    return (
      <section className="card">
        <h2>{t('notifications.installTitle')}</h2>
        <p className="muted">{t('notifications.installText')}</p>
        <InstallSteps />
        <button
          className="link"
          onClick={() => {
            setDismissed(true)
            try {
              localStorage.setItem('hundappen.installHintDismissed', '1')
            } catch {
              // ignoreras
            }
          }}
        >
          {t('notifications.notNow')}
        </button>
      </section>
    )

  if (status === 'unsupported' && isIOS() && !dismissed)
    return (
      <section className="card">
        <h2>{t('notifications.installTitle')}</h2>
        <p className="muted">{t('notifications.iosTooOld')}</p>
      </section>
    )

  if (status !== 'off') return null
  return (
    <section className="card form notify-card">
      <h2>🔔 {t('notifications.enableTitle')}</h2>
      <p className="muted">{t('notifications.enableText')}</p>
      {error && <p className="error">{error}</p>}
      <button className="primary" onClick={enable} disabled={busy}>
        {busy ? t('common.wait') : t('notifications.enable')}
      </button>
    </section>
  )
}
