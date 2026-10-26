import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isIOS, isStandalone } from './pwa.ts'
import InstallGuideScreen from './screens/InstallGuideScreen.tsx'
import { AuthProvider, useAuth } from './auth/AuthProvider.tsx'
import LoginScreen from './screens/LoginScreen.tsx'
import NameScreen from './screens/NameScreen.tsx'
import HomeScreen from './screens/HomeScreen.tsx'
import { HouseholdProvider } from './household/HouseholdProvider.tsx'

function Content() {
  const { t } = useTranslation()
  const { loading, session, profile } = useAuth()
  const [skipGuide, setSkipGuide] = useState(() => {
    try {
      return localStorage.getItem('hundappen.installGuideSkipped') === '1'
    } catch {
      return false
    }
  })

  if (loading) return <p className="muted center">{t('common.loading')}</p>
  if (!session && isIOS() && !isStandalone() && !skipGuide)
    return (
      <InstallGuideScreen
        onSkip={() => {
          setSkipGuide(true)
          try {
            localStorage.setItem('hundappen.installGuideSkipped', '1')
          } catch {
            // ignoreras
          }
        }}
      />
    )
  if (!session) return <LoginScreen />
  if (!profile?.display_name) return <NameScreen />
  return (
    <HouseholdProvider>
      <HomeScreen />
    </HouseholdProvider>
  )
}

export default function App() {
  const { t } = useTranslation()
  return (
    <main className="page">
      <header className="hero">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={56} height={56} />
        <h1>{t('app.name')}</h1>
      </header>
      <AuthProvider>
        <Content />
      </AuthProvider>
    </main>
  )
}
