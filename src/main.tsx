import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './pwa.ts'
import { captureInviteFromUrl } from './lib/invite.ts'
import { captureLogRequestFromUrl, listenForNotificationClicks } from './lib/deepLink.ts'

captureInviteFromUrl()
captureLogRequestFromUrl()
listenForNotificationClicks()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
