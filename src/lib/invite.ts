// Hjälpfunktioner för inbjudningskoder och inbjudningslänkar.

const STORAGE_KEY = 'hundappen.pendingInvite'

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// "K7P2MX4R" → "K7P2-MX4R"
export function formatCode(code: string): string {
  const c = normalizeCode(code)
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}

export function inviteLink(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?invite=${normalizeCode(code)}`
}

// Läser ?invite=… från adressen, sparar den tills användaren loggat in och tar bort den ur adressfältet.
export function captureInviteFromUrl(): void {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('invite')
  if (!code) return
  try {
    localStorage.setItem(STORAGE_KEY, normalizeCode(code))
  } catch {
    // Privat läge e.d. – koden går fortfarande att skriva in manuellt.
  }
  params.delete('invite')
  const query = params.toString()
  window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash)
}

export function getPendingInvite(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignoreras
  }
}
