import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider.tsx'
import FamilyCard from '../components/FamilyCard.tsx'
import StatusCard from '../components/StatusCard.tsx'
import NotificationSettings from '../components/NotificationSettings.tsx'
import type { Dog } from '../lib/types.ts'

export default function FamilyScreen({ dog }: { dog: Dog }) {
  const { t } = useTranslation()
  const { session, profile, signOut } = useAuth()
  return (
    <>
      <FamilyCard dogName={dog.name} />
      <NotificationSettings dogName={dog.name} />
      <section className="card">
        <h2>{t('home.account')}</h2>
        <p className="muted">{t('home.signedInAs', { name: profile?.display_name, email: session?.user.email })}</p>
        <button className="secondary" onClick={signOut}>
          {t('common.signOut')}
        </button>
      </section>
      <StatusCard />
    </>
  )
}
