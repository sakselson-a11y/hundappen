import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isIOS, isStandalone } from './pwa.ts'
import InstallGuideScreen from './screens/InstallGuideScreen.tsx'
import WeatherBadge from './components/WeatherBadge.tsx'
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

function Header() {
  const { t } = useTranslation()
  const { session, profile } = useAuth()
  return (
    <header className="app-header">
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={36} height={36} />
      <h1>{t('app.name')}</h1>
      {/* Väder visas bara för inloggade (frågar om platsåtkomst först när man trycker). */}
      {session && profile?.display_name && <WeatherBadge />}
    </header>
  )
}

export default function App() {
  return (
    <main className="page">
      <AuthProvider>
        <Header />
        <Content />
      </AuthProvider>
    </main>
  )
}
