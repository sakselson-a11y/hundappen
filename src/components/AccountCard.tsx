import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.ts'
import { accountAction } from '../lib/account.ts'
import { removeThisDevice } from '../lib/push.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import PrivacySheet from './PrivacySheet.tsx'

export default function AccountCard({ dogName }: { dogName: string }) {
  const { t } = useTranslation()
  const { session, profile, reloadProfile, signOut } = useAuth()
  const { role, members, reload } = useHousehold()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(profile?.display_name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const isOwner = role === 'owner'
  const othersExist = members.some((m) => m.user_id !== session?.user.id)

  async function saveName(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', session.user.id)
    setBusy(false)
    if (error) {
      setError(t('errors.generic'))
      return
    }
    setEditingName(false)
    await Promise.all([reloadProfile(), reload()])
  }

  async function leave() {
    setError(null)
    if (isOwner && othersExist) {
      setError(t('account.ownerMustTransfer'))
      return
    }
    const question = isOwner ? t('account.confirmLeaveLastOwner', { dog: dogName }) : t('account.confirmLeave', { dog: dogName })
    if (!window.confirm(question)) return
    setBusy(true)
    const result = await accountAction('leave')
    setBusy(false)
    if (result) {
      setError(result === 'owner_must_transfer' ? t('account.ownerMustTransfer') : t('errors.generic'))
      return
    }
    await reload()
  }

  async function deleteAccount() {
    setError(null)
    const question =
      isOwner && !othersExist ? t('account.confirmDeleteLastOwner', { dog: dogName }) : t('account.confirmDelete')
    if (!window.confirm(question)) return
    if (!window.confirm(t('account.confirmDeleteAgain'))) return
    setBusy(true)
    await removeThisDevice().catch(() => undefined)
    const result = await accountAction('delete')
    if (result) {
      setError(t('errors.generic'))
      setBusy(false)
      return
    }
    await signOut()
  }

  return (
    <>
      <section className="card form">
        <h2>{t('home.account')}</h2>
        {editingName ? (
          <form className="form" onSubmit={saveName}>
            <label>
              <span>{t('name.label')}</span>
              <input maxLength={40} required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="row">
              <button type="button" className="link" onClick={() => setEditingName(false)}>
                {t('common.cancel')}
              </button>
              <button className="primary" disabled={busy || !name.trim()}>
                {t('common.save')}
              </button>
            </div>
          </form>
        ) : (
          <div className="setting-row">
            <span>
              <strong>{profile?.display_name}</strong>
              <br />
              <span className="muted small">{session?.user.email}</span>
            </span>
            <button className="link" onClick={() => setEditingName(true)}>
              {t('account.changeName')}
            </button>
          </div>
        )}
        <button className="secondary" onClick={signOut}>
          {t('common.signOut')}
        </button>
        <div className="footer-links">
          <button className="link small" onClick={() => setShowPrivacy(true)}>
            {t('privacy.link')}
          </button>
        </div>
      </section>

      <section className="card form danger-zone">
        <h2>{t('account.dangerTitle')}</h2>
        <button className="secondary" onClick={leave} disabled={busy}>
          {t('account.leave', { dog: dogName })}
        </button>
        <p className="muted small">
          {isOwner && othersExist ? t('account.leaveOwnerHelp') : t('account.leaveHelp', { dog: dogName })}
        </p>
        <button className="danger-solid" onClick={deleteAccount} disabled={busy}>
          {busy ? t('common.wait') : t('account.delete')}
        </button>
        <p className="muted small">{t('account.deleteHelp')}</p>
        {error && <p className="error">{error}</p>}
      </section>

      {showPrivacy && <PrivacySheet onClose={() => setShowPrivacy(false)} />}
    </>
  )
}
