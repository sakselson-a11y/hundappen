import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../auth/AuthProvider.tsx'

export default function NameScreen() {
  const { t } = useTranslation()
  const { session, profile, reloadProfile, signOut } = useAuth()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setBusy(true)
    setError(null)
    // upsert skapar profilraden om den saknas (t.ex. för konton skapade före databasen).
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        display_name: name.trim(),
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .select()
    if (error || !data?.length) {
      setError(t('errors.generic'))
      setBusy(false)
      return
    }
    await reloadProfile()
    setBusy(false)
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
