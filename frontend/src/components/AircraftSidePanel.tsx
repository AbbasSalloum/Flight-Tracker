import { useEffect, useState } from 'react'
import type { Aircraft } from './AircraftMarker'
import FlightRouteBlock from './FlightRouteBlock'

type Props = {
  aircraft: Aircraft | null
  onClose: () => void
}

type FlightSummaryAirport = {
  code: string | null
  name: string | null
  city: string | null
  country: string | null
  time: number | null
}

type FlightSummary = {
  icao24: string
  callsign?: string | null
  fromAirport?: string | null
  toAirport?: string | null
  firstSeen?: number | null
  lastSeen?: number | null
  departure?: FlightSummaryAirport | null
  arrival?: FlightSummaryAirport | null
}

function formatMetric(value?: number | null, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A'
  return `${Math.round(value)}${suffix}`
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default function AircraftSidePanel({ aircraft, onClose }: Props) {
  const [summary, setSummary] = useState<FlightSummary | null>(null)

  useEffect(() => {
    const icao24 = aircraft?.icao24
    if (!icao24) {
      setSummary(null)
      return
    }

    let cancelled = false
    setSummary(null)

    const params = new URLSearchParams({ icao24 })
    const callsign = aircraft.callsign?.trim()
    if (callsign) params.set('callsign', callsign)

    fetch(`http://localhost:8080/api/flight/summary?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Summary request failed')
        return (await r.json()) as FlightSummary | null
      })
      .then((data) => {
        if (!cancelled) setSummary(data ?? null)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })

    return () => {
      cancelled = true
    }
  }, [aircraft?.icao24])

  if (!aircraft) return null

  const subtitleCountry = aircraft.originCountry?.trim() || 'Unknown country'
  const subtitleStatus = aircraft.onGround ? 'On ground' : 'Airborne'
  const callsign = aircraft.callsign?.trim() || aircraft.icao24.toUpperCase()

  return (
    <aside className="side-panel" aria-label="Selected aircraft details">
      <div className="side-panel__header">
        <div>
          <div className="callsign">{callsign}</div>
          <div className="sub">
            {subtitleCountry} · {subtitleStatus}
          </div>
        </div>

        <button type="button" onClick={onClose} aria-label="Close side panel">
          ✕
        </button>
      </div>

      <div className="side-panel__section">
        <FlightRouteBlock
          departure={summary?.departure}
          arrival={summary?.arrival}
          distanceKm={formatDistanceMetric(aircraft.distanceFlownKm)}
          remainingKm={formatDistanceMetric(aircraft.remainingKm)}
          progressPct={aircraft.progressPct ?? undefined}
        />
      </div>

      <div className="side-panel__section">
        <Row label="Altitude" value={formatMetric(aircraft.baroAltitude, ' m')} />
        <Row label="Speed" value={formatMetric(aircraft.velocity, ' m/s')} />
        <Row label="Heading" value={formatMetric(aircraft.trueTrack, '°')} />
        <Row label="On Ground" value={aircraft.onGround ? 'Yes' : 'No'} />
        <Row label="Squawk" value={aircraft.squawk?.trim() || 'N/A'} />
        <Row label="Latitude" value={aircraft.lat.toFixed(2)} />
        <Row label="Longitude" value={aircraft.lon.toFixed(2)} />
      </div>
    </aside>
  )
}

function formatDistanceMetric(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return undefined
  return Math.round(value)
}
