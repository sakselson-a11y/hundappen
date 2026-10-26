import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import StatusCard from '../components/StatusCard.tsx'
import DogCard from '../components/DogCard.tsx'
import CreateDogScreen from './CreateDogScreen.tsx'
import EditDogScreen from './EditDogScreen.tsx'

export default function HomeScreen() {
  const { t } = useTranslation()
  const { session, profile, signOut } = useAuth()
  const { loading, error, household, dogs, reload } = useHousehold()
  const [editing, setEditing] = useState(false)

  if (loading) return <p className="muted center">{t('common.loading')}</p>
  if (error)
    return (
      <section className="card form">
        <p className="error">{t('errors.network')}</p>
        <button className="secondary" onClick={reload}>
          {t('common.retry')}
        </button>
      </section>
    )
  if (!household) return <CreateDogScreen />

  // Version 1 visar en hund per hushåll.
  const dog = dogs[0]
  if (editing && dog) return <EditDogScreen dog={dog} onDone={() => setEditing(false)} />

  return (
    <>
      {dog && <DogCard dog={dog} onEdit={() => setEditing(true)} />}
      <section className="card">
        <p className="muted">{t('home.comingSoon')}</p>
      </section>
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
