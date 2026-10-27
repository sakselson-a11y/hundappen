import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.ts'
import { clearPendingInvite, formatCode, getPendingInvite, normalizeCode } from '../lib/invite.ts'
import { useInvitePreview } from '../lib/useInvitePreview.ts'
import { useHousehold } from '../household/HouseholdProvider.tsx'

export default function JoinHouseholdCard() {
  const { t } = useTranslation()
  const { reload } = useHousehold()
  const [code, setCode] = useState(() => formatCode(getPendingInvite() ?? ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = useInvitePreview(code)

  async function join(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('join_household', { invite_code: code })
    if (error) {
      setError(error.message === 'invalid_invite' ? t('invite.invalid') : t('errors.generic'))
      setBusy(false)
      return
    }
    clearPendingInvite()
    await reload()
  }

  return (
    <form className="card form" onSubmit={join}>
      <h2>{t('invite.joinTitle')}</h2>
      <p className="muted">{t('invite.joinText')}</p>
      <label>
        <span>{t('invite.codeLabel')}</span>
        <input
          className="code-input"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={9}
          placeholder="XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(formatCode(e.target.value))}
        />
      </label>
      {preview?.dogName && (
        <p className="success">
          {preview.guestDays
            ? t('invite.previewLineSitter', { inviter: preview.inviterName ?? t('invite.someone'), dog: preview.dogName, count: preview.guestDays })
            : t('invite.previewLine', { inviter: preview.inviterName ?? t('invite.someone'), dog: preview.dogName })}
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy || normalizeCode(code).length !== 8}>
        {busy ? t('common.wait') : preview?.dogName ? t('invite.joinDog', { dog: preview.dogName }) : t('invite.join')}
      </button>
    </form>
  )
}
