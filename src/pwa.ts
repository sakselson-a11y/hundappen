// Hjälpfunktioner för PWA-läge, plattform och service worker.

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  const ua = navigator.userAgent
  // iPad med iPadOS 13+ utger sig för att vara en Mac.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

// Webbpush på iPhone kräver iOS 16.4 eller senare.
export function iosTooOld(): boolean {
  const match = navigator.userAgent.match(/OS (\d+)_(\d+)/)
  if (!match) return false
  const [major, minor] = [Number(match[1]), Number(match[2])]
  return major < 16 || (major === 16 && minor < 4)
}

export function supportsPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
    scope: import.meta.env.BASE_URL,
  })
}
