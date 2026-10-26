import { useTranslation } from 'react-i18next'
import Sheet from './Sheet.tsx'

// Integritetstext. Innehållet ligger i språkfilen (privacy.sections).
export default function PrivacySheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const sections = t('privacy.sections', { returnObjects: true }) as { title: string; items: string[] }[]
  return (
    <Sheet onClose={onClose}>
      <div className="sheet-text">
        <h2>{t('privacy.title')}</h2>
        <p className="muted">{t('privacy.intro')}</p>
        {sections.map((s) => (
          <section key={s.title}>
            <h3>{s.title}</h3>
            <ul>
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="muted small">{t('privacy.updated')}</p>
      </div>
      <button className="secondary" onClick={onClose}>
        {t('common.close')}
      </button>
    </Sheet>
  )
}
