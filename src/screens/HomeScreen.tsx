import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import { EventsProvider } from '../household/EventsProvider.tsx'
import { SchedulesProvider } from '../household/SchedulesProvider.tsx'
import ScheduleScreen from './ScheduleScreen.tsx'
import PhotosScreen from './PhotosScreen.tsx'
import TabBar, { type Tab } from '../components/TabBar.tsx'
import { subscribeLogRequests, type LogRequest } from '../lib/deepLink.ts'
import CreateDogScreen from './CreateDogScreen.tsx'
import EditDogScreen from './EditDogScreen.tsx'
import OverviewScreen from './OverviewScreen.tsx'
import HistoryScreen from './HistoryScreen.tsx'
import FamilyScreen from './FamilyScreen.tsx'

export default function HomeScreen() {
  const { t } = useTranslation()
  const { loading, error, household, dogs, reload } = useHousehold()
  const [tab, setTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)
  const [logRequest, setLogRequest] = useState<LogRequest | null>(null)

  // Tryck på en påminnelse: visa översikten med loggformuläret öppet.
  useEffect(
    () =>
      subscribeLogRequests((request) => {
        setEditing(false)
        setTab('overview')
        setLogRequest(request)
      }),
    [],
  )

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
  if (!dog) return <p className="muted center">{t('errors.generic')}</p>
  if (editing) return <EditDogScreen dog={dog} onDone={() => setEditing(false)} />

  function changeTab(next: Tab) {
    setTab(next)
    window.scrollTo(0, 0)
  }

  return (
    <EventsProvider>
      <SchedulesProvider>
        <div className="with-tabbar">
          {tab === 'overview' && (
            <OverviewScreen
              dog={dog}
              onEditDog={() => setEditing(true)}
              onOpenSchedule={() => changeTab('schedule')}
              logRequest={logRequest}
              onLogRequestHandled={() => setLogRequest(null)}
            />
          )}
          {tab === 'history' && <HistoryScreen />}
          {tab === 'photos' && <PhotosScreen />}
          {tab === 'schedule' && <ScheduleScreen dog={dog} />}
          {tab === 'family' && <FamilyScreen dog={dog} />}
        </div>
        <TabBar active={tab} onChange={changeTab} />
      </SchedulesProvider>
    </EventsProvider>
  )
}
