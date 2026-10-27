// Aktuellt väder där man är, från Open-Meteo (open-meteo.com, CC BY 4.0).
// Positionen avrundas till två decimaler (ca 1 km) och sparas aldrig i databasen.
import { useCallback, useEffect, useRef, useState } from 'react'

const ENABLED_KEY = 'hundappen.weatherEnabled'
const CACHE_KEY = 'hundappen.weather'
const REFRESH_MS = 30 * 60 * 1000

export interface Weather {
  temperature: number
  code: number // WMO-väderkod
  isDay: boolean
  fetchedAt: number
}

export type WeatherState =
  | { status: 'off' } // inte påslaget än: visa knappen "Väder"
  | { status: 'loading'; last: Weather | null }
  | { status: 'ok'; weather: Weather }
  | { status: 'denied' } // nekad platsåtkomst: visa ingenting
  | { status: 'error'; last: Weather | null }

// WMO-väderkoder → symbol och svensk beskrivning.
export function describeWeather(code: number, isDay: boolean): { icon: string; label: string } {
  if (code === 0) return { icon: isDay ? '☀️' : '🌙', label: 'Klart' }
  if (code <= 2) return { icon: isDay ? '🌤️' : '🌙', label: 'Mestadels klart' }
  if (code === 3) return { icon: '☁️', label: 'Mulet' }
  if (code === 45 || code === 48) return { icon: '🌫️', label: 'Dimma' }
  if (code >= 51 && code <= 57) return { icon: '🌦️', label: 'Duggregn' }
  if (code >= 61 && code <= 67) return { icon: '🌧️', label: 'Regn' }
  if (code >= 71 && code <= 77) return { icon: '🌨️', label: 'Snö' }
  if (code >= 80 && code <= 82) return { icon: '🌦️', label: 'Regnskurar' }
  if (code === 85 || code === 86) return { icon: '🌨️', label: 'Snöbyar' }
  if (code >= 95) return { icon: '⛈️', label: 'Åska' }
  return { icon: '🌡️', label: 'Väder' }
}

function readCache(): Weather | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
  } catch {
    return null
  }
}

function isEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

function setEnabled(value: boolean) {
  try {
    if (value) localStorage.setItem(ENABLED_KEY, '1')
    else localStorage.removeItem(ENABLED_KEY)
  } catch {
    // ignoreras
  }
}

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: REFRESH_MS,
      timeout: 15000,
    }),
  )
}

async function fetchWeather(): Promise<Weather> {
  const pos = await position()
  const lat = pos.coords.latitude.toFixed(2)
  const lon = pos.coords.longitude.toFixed(2)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  const data = await res.json()
  const weather: Weather = {
    temperature: data.current.temperature_2m,
    code: data.current.weather_code,
    isDay: data.current.is_day === 1,
    fetchedAt: Date.now(),
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(weather))
  } catch {
    // ignoreras
  }
  return weather
}

export function useWeather(): [WeatherState, () => void] {
  const [state, setState] = useState<WeatherState>(() => {
    if (!('geolocation' in navigator)) return { status: 'denied' }
    if (!isEnabled()) return { status: 'off' }
    const cached = readCache()
    return cached ? { status: 'ok', weather: cached } : { status: 'loading', last: null }
  })

  // Bara en hämtning åt gången (annars kan iPhone fråga om platsåtkomst två gånger).
  const inFlight = useRef(false)

  const refresh = useCallback(async (force = false) => {
    if (inFlight.current) return
    const cached = readCache()
    if (!force && cached && Date.now() - cached.fetchedAt < REFRESH_MS) {
      setState({ status: 'ok', weather: cached })
      return
    }
    setState({ status: 'loading', last: cached })
    inFlight.current = true
    try {
      setState({ status: 'ok', weather: await fetchWeather() })
      setEnabled(true)
    } catch (err) {
      // Nekad platsåtkomst: göm vädret (kan slås på igen i iPhones inställningar).
      if ((err as GeolocationPositionError)?.code === 1) {
        setEnabled(false)
        setState({ status: 'denied' })
      } else {
        setState({ status: 'error', last: cached })
      }
    } finally {
      inFlight.current = false
    }
  }, [])

  // Påslaget (även direkt efter första knapptrycket): uppdatera vid start, när appen visas och var 30:e minut.
  const active = state.status !== 'off' && state.status !== 'denied'

  useEffect(() => {
    if (!active) return
    refresh()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    const id = setInterval(() => refresh(), REFRESH_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(id)
    }
  }, [active, refresh])

  // Knapptryck: första gången frågar iPhone om platsåtkomst.
  return [state, () => refresh(true)]
}
