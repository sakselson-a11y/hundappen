import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider.tsx'
import StatusCard from '../components/StatusCard.tsx'

// Tillfällig startsida. Hund, loggning och översikt kommer i steg 3–5.
export default function HomeScreen() {
  const { t } = useTranslation()
  const { session, profile, signOut } = useAuth()

  return (
    <>
      <section className="card">
        <h2>{t('home.greeting', { name: profile?.display_name })}</h2>
        <p className="muted">{t('home.signedInAs', { email: session?.user.email })}</p>
        <p className="muted">{t('home.comingSoon')}</p>
        <button className="secondary" onClick={signOut}>
          {t('common.signOut')}
        </button>
      </section>
      <StatusCard />
    </>
  )
}
