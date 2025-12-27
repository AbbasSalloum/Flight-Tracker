import { useEffect, useState } from 'react'
import type { Aircraft } from './AircraftMarker'
import './SelectedAircraftPanel.css'

const POSITION_SOURCES = ['ADS-B', 'ASTERIX', 'MLAT'] as const

type AirportInfo = {
  code: string | null
  name: string | null
  city: string | null
  country: string | null
}

type RouteInfo = {
  callsign: string
  from: string | null
  to: string | null
  route: string[] | null
  fromAirport: AirportInfo | null
  toAirport: AirportInfo | null
}

function title(a: Aircraft) {
  return a.callsign?.trim() || a.icao24.toUpperCase()
}
function fmt(v: number | null | undefined, suffix = '') {
  return typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v)}${suffix}` : '—'
}
function fmtTime(ts?: number | null) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString()
}
function fmtCoords(lat: number, lon: number) {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(2)}° ${latDir}, ${Math.abs(lon).toFixed(2)}° ${lonDir}`
}
function fmtPositionSource(value?: number | null) {
  if (value === null || value === undefined) return '—'
  return POSITION_SOURCES[value] ?? `Source ${value}`
}
function fmtAirport(airport?: AirportInfo | null, fallback?: string | null) {
  if (!airport) return fallback || '—'
  const locationParts = [airport.city, airport.country].filter(Boolean).join(', ')
  const details = [airport.name, locationParts].filter(Boolean).join(' — ')
  const code = airport.code || fallback
  if (details && code) return `${details} (${code})`
  return details || code || fallback || '—'
}

export default function SelectedAircraftPanel({
  aircraft,
  onClose
}: {
  aircraft: Aircraft
  onClose: () => void
}) {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [routeStatus, setRouteStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  useEffect(() => {
    let cancelled = false
    const callsign = aircraft.callsign?.trim()

    if (!callsign) {
      setRouteInfo(null)
      setRouteStatus('idle')
      return () => {
        cancelled = true
      }
    }

    const controller = new AbortController()
    setRouteStatus('loading')
    setRouteInfo(null)

    fetch(`http://localhost:8080/api/routes/${encodeURIComponent(callsign)}`, {
      signal: controller.signal
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Route error ${r.status}`)
        return r.json()
      })
      .then((data: RouteInfo) => {
        if (!cancelled) {
          setRouteInfo(data)
          setRouteStatus('ready')
        }
      })
      .catch((err) => {
        if (cancelled || err.name === 'AbortError') return
        setRouteStatus('error')
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [aircraft.callsign])

  const renderRouteValue = (field: 'from' | 'to') => {
    if (!aircraft.callsign?.trim()) return '—'
    if (routeStatus === 'loading') return 'Loading...'
    if (routeStatus === 'error') return 'Unavailable'
    const airport = field === 'from' ? routeInfo?.fromAirport : routeInfo?.toAirport
    const fallback = field === 'from' ? routeInfo?.from : routeInfo?.to
    return fmtAirport(airport, fallback ?? null)
  }

  return (
    <div className="sel">
      <div className="sel__header">
        <div>
          <div className="sel__title">{title(aircraft)}</div>
          <div className="sel__sub">
            From {aircraft.originCountry} • {aircraft.onGround ? 'On ground' : 'Airborne'}
          </div>
        </div>

        <button className="sel__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="sel__grid">
        <div className="kv">
          <div className="kv__k">ICAO24</div>
          <div className="kv__v">{aircraft.icao24.toUpperCase()}</div>
        </div>

        <div className="kv kv--wide">
          <div className="kv__k">Origin</div>
          <div className="kv__v">{aircraft.originCountry || '—'}</div>
        </div>

        <div className="kv kv--wide">
          <div className="kv__k">Current position</div>
          <div className="kv__v">{fmtCoords(aircraft.lat, aircraft.lon)}</div>
        </div>

        <div className="kv">
          <div className="kv__k">Altitude</div>
          <div className="kv__v">{fmt(aircraft.baroAltitude, ' m')}</div>
        </div>

        <div className="kv">
          <div className="kv__k">Geo altitude</div>
          <div className="kv__v">{fmt(aircraft.geoAltitude ?? null, ' m')}</div>
        </div>

        <div className="kv">
          <div className="kv__k">Speed</div>
          <div className="kv__v">{fmt(aircraft.velocity, ' m/s')}</div>
        </div>

        <div className="kv">
          <div className="kv__k">Vertical rate</div>
          <div className="kv__v">{fmt(aircraft.verticalRate ?? null, ' m/s')}</div>
        </div>

        <div className="kv">
          <div className="kv__k">Heading</div>
          <div className="kv__v">{fmt(aircraft.trueTrack, '°')}</div>
        </div>

        <div className="kv">
          <div className="kv__k">Squawk</div>
          <div className="kv__v">{aircraft.squawk?.trim() || '—'}</div>
        </div>

        <div className="kv">
          <div className="kv__k">Departure airport</div>
          <div className="kv__v">{renderRouteValue('from')}</div>
        </div>

        <div className="kv">
          <div className="kv__k">Arrival airport</div>
          <div className="kv__v">{renderRouteValue('to')}</div>
        </div>

        <div className="kv">
          <div className="kv__k">Source</div>
          <div className="kv__v">{fmtPositionSource(aircraft.positionSource ?? null)}</div>
        </div>

        <div className="kv kv--wide">
          <div className="kv__k">Last contact</div>
          <div className="kv__v">{fmtTime(aircraft.lastContact ?? null)}</div>
        </div>

        <div className="kv kv--wide">
          <div className="kv__k">Last position update</div>
          <div className="kv__v">{fmtTime(aircraft.timePosition ?? null)}</div>
        </div>
      </div>
    </div>
  )
}
