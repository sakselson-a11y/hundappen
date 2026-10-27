import { useTranslation } from 'react-i18next'
import { formatCode, getPendingInvite } from '../lib/invite.ts'
import { useInvitePreview } from '../lib/useInvitePreview.ts'

// Visas på inloggningssidan när man öppnat en inbjudningslänk.
export default function InviteBanner() {
  const { t } = useTranslation()
  const code = getPendingInvite()
  const preview = useInvitePreview(code)
  if (!code) return null

  return (
    <section className="card invite-banner">
      <h2>
        {preview?.dogName
          ? preview.guestDays
            ? t('invite.bannerTitleSitter', { inviter: preview.inviterName ?? t('invite.someone'), dog: preview.dogName, count: preview.guestDays })
            : t('invite.bannerTitle', { inviter: preview.inviterName ?? t('invite.someone'), dog: preview.dogName })
          : t('invite.bannerTitleGeneric')}
      </h2>
      <p className="muted">{t('invite.bannerText')}</p>
      <p className="invite-code">{formatCode(code)}</p>
    </section>
  )
}
