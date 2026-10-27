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
  guest_days: number | null
}

const SITTER_DAYS = [1, 2, 3, 5, 7, 14, 30]

export default function FamilyCard({ dogName }: { dogName: string }) {
  const { t, i18n } = useTranslation()
  const { session } = useAuth()
  const { role, members, reload } = useHousehold()
  const [error, setError] = useState<string | null>(null)
  const isOwner = role === 'owner'
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' })

  async function makeOwner(member: Member) {
    if (!window.confirm(t('family.confirmMakeOwner', { name: member.display_name ?? '' }))) return
    const { error } = await supabase.rpc('transfer_ownership', { new_owner: member.user_id })
    if (error) setError(t('errors.generic'))
    await reload()
  }

  async function remove(member: Member, householdId: string) {
    const name = member.display_name ?? ''
    if (!window.confirm(t('family.confirmRemove', { name, dog: dogName }))) return
    await supabase.from('household_members').delete().eq('household_id', householdId).eq('user_id', member.user_id)
    await reload()
  }

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
            {m.expires_at && <span className="tag sitter">{t('family.sitterUntil', { date: shortDate(m.expires_at) })}</span>}
            {isOwner && m.user_id !== session?.user.id && (
              <span className="row">
                {!m.expires_at && (
                  <button className="link small" onClick={() => makeOwner(m)}>
                    {t('family.makeOwner')}
                  </button>
                )}
                <button className="link small danger" onClick={() => remove(m, m.household_id)}>
                  {t('family.remove')}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <>
          <InviteBox dogName={dogName} />
          <InviteBox dogName={dogName} sitter />
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}

// Inbjudan för familjemedlem eller (sitter) hundvakt under ett antal dagar.
function InviteBox({ dogName, sitter = false }: { dogName: string; sitter?: boolean }) {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const { household } = useHousehold()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [days, setDays] = useState(7)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const householdId = household?.id

  const load = useCallback(async () => {
    if (!householdId) return
    let query = supabase
      .from('household_invites')
      .select('code, expires_at, guest_days')
      .eq('household_id', householdId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
    query = sitter ? query.not('guest_days', 'is', null) : query.is('guest_days', null)
    const { data } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle()
    setInvite(data as Invite | null)
  }, [householdId, sitter])

  useEffect(() => {
    load()
  }, [load])

  async function create() {
    if (!householdId) return
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('create_invite', {
      hid: householdId,
      invite_guest_days: sitter ? days : null,
    })
    setBusy(false)
    if (error || !data) setError(t('errors.generic'))
    else setInvite(data as Invite)
  }

  async function share() {
    if (!invite) return
    const text = t(sitter ? 'invite.shareTextSitter' : 'invite.shareText', {
      inviter: profile?.display_name,
      dog: dogName,
      days: invite.guest_days,
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

  const expires = invite
    ? new Date(invite.expires_at).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' })
    : null

  return (
    <div className="invite-box">
      <h3>{sitter ? t('family.sitterTitle') : t('family.inviteTitle')}</h3>
      <p className="muted small">{sitter ? t('family.sitterText', { dog: dogName }) : t('family.inviteText')}</p>
      {invite ? (
        <>
          <p className="invite-code">{formatCode(invite.code)}</p>
          <p className="muted small">
            {sitter && `${t('family.sitterDays', { count: invite.guest_days ?? 0 })} · `}
            {t('family.inviteExpires', { date: expires })}
          </p>
          <button className="primary" onClick={share}>
            {copied ? t('family.copied') : t('family.share')}
          </button>
          <button className="link" onClick={() => setInvite(null)} disabled={busy}>
            {t('family.newCode')}
          </button>
        </>
      ) : (
        <>
          {sitter && (
            <label className="inline-field">
              <span>{t('family.sitterHowLong')}</span>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {SITTER_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {t('family.sitterDays', { count: d })}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className={sitter ? 'secondary' : 'primary'} onClick={create} disabled={busy}>
            {busy ? t('common.wait') : sitter ? t('family.createSitterInvite') : t('family.createInvite')}
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
