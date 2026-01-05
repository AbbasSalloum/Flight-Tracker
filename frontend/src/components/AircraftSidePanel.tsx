import { useEffect, useState } from 'react'
import type { Aircraft } from './AircraftMarker'
import FlightRouteBlock from './FlightRouteBlock'

type Props = {
  aircraft: Aircraft | null
  onClose: () => void
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
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    if (!aircraft) {
      setSummary(null)
      return
    }

    let cancelled = false
    setSummary(null)

    fetch(`http://localhost:8080/api/flight/summary?icao24=${aircraft.icao24}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })

    return () => {
      cancelled = true
    }
  }, [aircraft])

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
          from={summary?.fromAirport}
          to={summary?.toAirport}
          departedAt={summary?.firstSeen}
          distanceKm={Math.round(aircraft.distanceFlownKm || 0)}
          remainingKm={Math.round(aircraft.remainingKm || 0)}
          progressPct={aircraft.progressPct}
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
