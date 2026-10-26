import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import sv from './locales/sv.json'

// Fler språk läggs till som nya filer i locales/ och registreras här.
i18n.use(initReactI18next).init({
  resources: { sv: { translation: sv } },
  lng: 'sv',
  fallbackLng: 'sv',
  interpolation: { escapeValue: false },
})

export default i18n
