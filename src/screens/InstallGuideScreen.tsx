import { useTranslation } from 'react-i18next'
import InstallSteps from '../components/InstallSteps.tsx'
import { formatCode, getPendingInvite } from '../lib/invite.ts'

// Visas vid första start i Safari på iPhone, innan inloggning.
export default function InstallGuideScreen({ onSkip }: { onSkip: () => void }) {
  const { t } = useTranslation()
  const invite = getPendingInvite()
  return (
    <>
      <section className="card">
        <h2>{t('install.title')}</h2>
        <p className="muted">{t('install.intro')}</p>
        <InstallSteps />
      </section>
      {invite && (
        <section className="card invite-banner">
          <h2>{t('install.inviteTitle')}</h2>
          <p className="muted">{t('install.inviteText')}</p>
          <p className="invite-code">{formatCode(invite)}</p>
        </section>
      )}
      <button className="link full" onClick={onSkip}>
        {t('install.skip')}
      </button>
    </>
  )
}
