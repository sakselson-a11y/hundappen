import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.ts'
import { authErrorMessage } from '../lib/errors.ts'

type Step = 'email' | 'code'

export default function LoginScreen() {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    })
    setBusy(false)
    if (error) setError(authErrorMessage(t, error))
    else setStep('code')
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    // Vid lyckad inloggning tar AuthProvider över och visar nästa vy.
    if (error) setError(authErrorMessage(t, error, 'verify'))
  }

  if (step === 'code') {
    return (
      <form className="card form" onSubmit={verifyCode}>
        <h2>{t('login.codeTitle')}</h2>
        <p className="muted">{t('login.codeSent', { email: email.trim() })}</p>
        <label>
          <span>{t('login.codeLabel')}</span>
          <input
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            maxLength={10}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy || code.length < 6}>
          {busy ? t('common.wait') : t('login.signIn')}
        </button>
        <div className="row">
          <button type="button" className="link" disabled={busy} onClick={() => sendCode()}>
            {t('login.resend')}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              setStep('email')
              setCode('')
              setError(null)
            }}
          >
            {t('login.changeEmail')}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form className="card form" onSubmit={sendCode}>
      <h2>{t('login.title')}</h2>
      <p className="muted">{t('login.intro')}</p>
      <label>
        <span>{t('login.emailLabel')}</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>
        {busy ? t('common.wait') : t('login.sendCode')}
      </button>
    </form>
  )
}
