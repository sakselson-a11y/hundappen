import { useTranslation } from 'react-i18next'

export type Tab = 'overview' | 'history' | 'family'

const TABS: { id: Tab; icon: string }[] = [
  { id: 'overview', icon: '🏠' },
  { id: 'history', icon: '📋' },
  { id: 'family', icon: '👨‍👩‍👧' },
]

export default function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const { t } = useTranslation()
  return (
    <nav className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={active === tab.id ? 'active' : ''}
          aria-current={active === tab.id ? 'page' : undefined}
          onClick={() => onChange(tab.id)}
        >
          <span aria-hidden>{tab.icon}</span>
          {t(`tabs.${tab.id}`)}
        </button>
      ))}
    </nav>
  )
}
