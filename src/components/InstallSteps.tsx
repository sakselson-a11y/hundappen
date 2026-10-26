import { useTranslation } from 'react-i18next'

// Steg för att lägga till appen på hemskärmen i Safari på iPhone.
export default function InstallSteps() {
  const { t } = useTranslation()
  return (
    <ol className="install-steps">
      <li>
        <span className="step-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12M8 7l4-4 4 4" />
            <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
          </svg>
        </span>
        <span>{t('install.step1')}</span>
      </li>
      <li>
        <span className="step-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </span>
        <span>{t('install.step2')}</span>
      </li>
      <li>
        <span className="step-icon" aria-hidden>
          ✓
        </span>
        <span>{t('install.step3')}</span>
      </li>
      <li>
        <img className="step-icon" src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
        <span>{t('install.step4')}</span>
      </li>
    </ol>
  )
}
