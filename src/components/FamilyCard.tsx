import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.ts'
import { formatCode, inviteLink } from '../lib/invite.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { useHousehold } from '../household/HouseholdProvider.tsx'
import type { Member } from '../lib/types.ts'

interface Invite {
  code: string
  expires_at: string
}

export default function FamilyCard({ dogName }: { dogName: string }) {
  const { t, i18n } = useTranslation()
  const { session, profile } = useAuth()
  const { household, role, members, reload } = useHousehold()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isOwner = role === 'owner'
  const householdId = household?.id

  const load = useCallback(async () => {
    if (!householdId) return
    if (isOwner) {
      const { data: inv } = await supabase
        .from('household_invites')
        .select('code, expires_at')
        .eq('household_id', householdId)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setInvite(inv as Invite | null)
    }
  }, [householdId, isOwner])

  useEffect(() => {
    load()
  }, [load])

  async function newInvite() {
    if (!householdId) return
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('create_invite', { hid: householdId })
    setBusy(false)
    if (error || !data) setError(t('errors.generic'))
    else setInvite(data as Invite)
  }

  async function share() {
    if (!invite) return
    const text = t('invite.shareText', {
      inviter: profile?.display_name,
      dog: dogName,
      link: inviteLink(invite.code),
      code: formatCode(invite.code),
    })
    if (navigator.share) {
      try {
        await navigator.share({ text })
      } catch {
        // Användaren avbröt delningen.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setError(t('errors.generic'))
    }
  }

  async function makeOwner(member: Member) {
    if (!window.confirm(t('family.confirmMakeOwner', { name: member.display_name ?? '' }))) return
    const { error } = await supabase.rpc('transfer_ownership', { new_owner: member.user_id })
    if (error) setError(t('errors.generic'))
    await reload()
  }

  async function remove(member: Member) {
    if (!householdId) return
    const name = member.display_name ?? ''
    if (!window.confirm(t('family.confirmRemove', { name, dog: dogName }))) return
    await supabase.from('household_members').delete().eq('household_id', householdId).eq('user_id', member.user_id)
    await reload()
  }

  const expires = invite
    ? new Date(invite.expires_at).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' })
    : null

  return (
    <section className="card">
      <h2>{t('family.title')}</h2>
      <ul className="members">
        {members.map((m) => (
          <li key={m.user_id}>
            <span className="avatar">{(m.display_name ?? '?').slice(0, 1).toUpperCase()}</span>
            <span className="member-name">
              {m.display_name ?? t('family.unnamed')}
              {m.user_id === session?.user.id && <span className="muted"> {t('family.you')}</span>}
            </span>
            {m.role === 'owner' && <span className="tag">{t('family.owner')}</span>}
            {isOwner && m.user_id !== session?.user.id && (
              <span className="row">
                <button className="link small" onClick={() => makeOwner(m)}>
                  {t('family.makeOwner')}
                </button>
                <button className="link small danger" onClick={() => remove(m)}>
                  {t('family.remove')}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <div className="invite-box">
          <h3>{t('family.inviteTitle')}</h3>
          {invite ? (
            <>
              <p className="muted">{t('family.inviteText')}</p>
              <p className="invite-code">{formatCode(invite.code)}</p>
              <p className="muted small">{t('family.inviteExpires', { date: expires })}</p>
              <button className="primary" onClick={share}>
                {copied ? t('family.copied') : t('family.share')}
              </button>
              <button className="link" onClick={newInvite} disabled={busy}>
                {t('family.newCode')}
              </button>
            </>
          ) : (
            <button className="primary" onClick={newInvite} disabled={busy}>
              {busy ? t('common.wait') : t('family.createInvite')}
            </button>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </section>
  )
}
