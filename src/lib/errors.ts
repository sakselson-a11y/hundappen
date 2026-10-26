import type { TFunction } from 'i18next'

// Översätter fel från Supabase till begripliga meddelanden.
export function authErrorMessage(t: TFunction, error: unknown, context: 'send' | 'verify' = 'send'): string {
  const e = error as { code?: string; status?: number; message?: string }
  // Vid inloggning med kod betyder ett avvisat anrop nästan alltid fel eller gammal kod.
  if (context === 'verify' && (e?.status === 400 || e?.status === 401 || e?.status === 403)) {
    return t('errors.invalidCode')
  }
  if (e?.code === 'over_email_send_rate_limit' || e?.status === 429) return t('errors.rateLimit')
  if (e?.code === 'otp_expired' || e?.code === 'invalid_otp') return t('errors.invalidCode')
  if (e?.code === 'email_address_invalid' || e?.code === 'validation_failed') return t('errors.invalidEmail')
  if (e?.message?.toLowerCase().includes('fetch')) return t('errors.network')
  return t('errors.generic')
}
