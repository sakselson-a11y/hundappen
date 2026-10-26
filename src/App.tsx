import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isStandalone, supportsPush } from './pwa.ts'

export default function App() {
  const { t } = useTranslation()
  const [swReady, setSwReady] = useState(false)
  const standalone = isStandalone()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(() => setSwReady(true))
  }, [])

  return (
    <main className="page">
      <header className="hero">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={72} height={72} />
        <h1>{t('app.name')}</h1>
        <p>{t('app.tagline')}</p>
      </header>

      <section className="card">
        <h2>{t('status.title')}</h2>
        <dl className="status">
          <dt>{standalone ? t('status.installed') : t('status.notInstalled')}</dt>
          <dd>{standalone ? '✅' : '⚠️'}</dd>
          <dt>{t('status.serviceWorker')}</dt>
          <dd>{swReady ? t('status.ready') : t('status.notReady')}</dd>
          <dt>{t('status.pushSupport')}</dt>
          <dd>{supportsPush() ? t('status.yes') : t('status.no')}</dd>
          <dt>{t('status.version')}</dt>
          <dd>{__APP_VERSION__}</dd>
        </dl>
        {!standalone && <p className="hint">{t('status.noInstallHint')}</p>}
      </section>
    </main>
  )
}
