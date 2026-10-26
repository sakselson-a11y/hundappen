import { useTranslation } from 'react-i18next'
import { AuthProvider, useAuth } from './auth/AuthProvider.tsx'
import LoginScreen from './screens/LoginScreen.tsx'
import NameScreen from './screens/NameScreen.tsx'
import HomeScreen from './screens/HomeScreen.tsx'

function Content() {
  const { t } = useTranslation()
  const { loading, session, profile } = useAuth()

  if (loading) return <p className="muted center">{t('common.loading')}</p>
  if (!session) return <LoginScreen />
  if (!profile?.display_name) return <NameScreen />
  return <HomeScreen />
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
