import { useTranslation } from 'react-i18next'
import { describeWeather, useWeather } from '../lib/weather.ts'

// Väder där man är, till höger i sidhuvudet. Tryck för att uppdatera.
export default function WeatherBadge() {
  const { t } = useTranslation()
  const [state, refresh] = useWeather()

  if (state.status === 'denied') return null
  if (state.status === 'off')
    return (
      <button className="weather-badge off" onClick={refresh} aria-label={t('weather.enable')}>
        🌤️ {t('weather.button')}
      </button>
    )

  const weather = state.status === 'ok' ? state.weather : state.last
  if (!weather)
    return (
      <span className="weather-badge" aria-live="polite">
        {state.status === 'loading' ? '…' : '–'}
      </span>
    )

  const { icon, label } = describeWeather(weather.code, weather.isDay)
  const temp = Math.round(weather.temperature)
  return (
    <button
      className={`weather-badge ${state.status === 'loading' ? 'loading' : ''}`}
      onClick={refresh}
      aria-label={t('weather.label', { label, temp })}
      title={t('weather.label', { label, temp })}
    >
      <span aria-hidden>{icon}</span> {temp}°
    </button>
  )
}
