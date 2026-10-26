import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../auth/AuthProvider.tsx'

export default function NameScreen() {
  const { t } = useTranslation()
  const { profile, reloadProfile, signOut } = useAuth()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: name.trim(),
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .eq('id', profile.id)
    if (error) {
      setError(t('errors.generic'))
      setBusy(false)
      return
    }
    await reloadProfile()
  }

  return (
    <form className="card form" onSubmit={save}>
      <h2>{t('name.title')}</h2>
      <p className="muted">{t('name.intro')}</p>
      <label>
        <span>{t('name.label')}</span>
        <input
          autoComplete="given-name"
          maxLength={40}
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy || !name.trim()}>
        {busy ? t('common.wait') : t('common.continue')}
      </button>
      <button type="button" className="link" onClick={signOut}>
        {t('common.signOut')}
      </button>
    </form>
  )
}
