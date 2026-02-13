import { useEffect, useMemo, useRef, useState } from 'react'
import type { Aircraft } from './AircraftMarker'
import './FlightBottomSheet.css'

function fmtMaybe(n: number | null | undefined, suffix = '') {
  return typeof n === 'number' && Number.isFinite(n) ? `${Math.round(n)}${suffix}` : 'N/A'
}

function fmtCoord(n: number) {
  return Number.isFinite(n) ? n.toFixed(4) : 'N/A'
}

export type FlightSummaryAirport = {
  code: string | null
  name: string | null
  city: string | null
  country: string | null
  time: number | null
}

export type FlightSummary = {
  departure?: FlightSummaryAirport | null
  arrival?: FlightSummaryAirport | null
}

type FlightBottomSheetProps = {
  aircraft: Aircraft | null
  open: boolean
  summary?: FlightSummary | null
  onClose: () => void
}

export default function FlightBottomSheet({ aircraft, open, summary, onClose }: FlightBottomSheetProps) {
  const [shouldRender, setShouldRender] = useState(open)
  const [expanded, setExpanded] = useState(true)
  const sheetRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      return
    }
    const timer = window.setTimeout(() => setShouldRender(false), 220)
    return () => window.clearTimeout(timer)
  }, [open])

  const title = useMemo(() => {
    if (!aircraft) return ''
    return (aircraft.callsign || aircraft.icao24).trim()
  }, [aircraft])

  if (!shouldRender || !aircraft) return null

  const departure = summary?.departure || null
  const arrival = summary?.arrival || null

  return (
    <div
      className={`sheet ${open ? 'sheet--open' : 'sheet--closed'}`}
      ref={sheetRef}
      role="dialog"
      aria-modal="false"
      aria-label="Flight details"
    >
      <div className="sheet-header">
        <div className="sheet-title">
          <div className="sheet-callsign">{title}</div>
          <div className="sheet-subtitle">
            {aircraft.originCountry} • {aircraft.onGround ? 'On ground' : 'Airborne'}
          </div>
        </div>

        <button className="sheet-close" onClick={onClose} aria-label="Close details">
          ✕
        </button>
      </div>

      <div className="sheet-route">
        <div className="sheet-route__codes">
          <AirportCard label="Departure" airport={departure} />
          <div className="sheet-route__arrow">→</div>
          <AirportCard label="Arrival" airport={arrival} align="right" />
        </div>
        <div className="sheet-route__times">
          <div>
            <span>Departure</span>
            <strong>{formatTime(departure?.time)}</strong>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span>Scheduled arrival</span>
            <strong>{formatTime(arrival?.time)}</strong>
          </div>
        </div>
      </div>

      <div className="sheet-content">
        <div className="sheet-row">
          <div className="kv">
            <div className="k">ICAO24</div>
            <div className="v mono">{aircraft.icao24}</div>
          </div>
          <div className="kv">
            <div className="k">Callsign</div>
            <div className="v mono">{aircraft.callsign?.trim() || 'N/A'}</div>
          </div>
        </div>

        <div className="sheet-row compact">
          <StatBlock label="Altitude" value={fmtMaybe(aircraft.baroAltitude, ' m')} />
          <StatBlock label="Speed" value={fmtMaybe(aircraft.velocity, ' m/s')} />
          <StatBlock label="Track" value={fmtMaybe(aircraft.trueTrack, '°')} />
        </div>

        <button className="sheet-section-btn" onClick={() => setExpanded((s) => !s)}>
          <span>More details</span>
          <span className={`chev ${expanded ? 'up' : 'down'}`}>⌃</span>
        </button>

        {expanded && (
          <div className="sheet-section">
            <div className="kv">
              <div className="k">Latitude</div>
              <div className="v mono">{fmtCoord(aircraft.lat)}</div>
            </div>
            <div className="kv">
              <div className="k">Longitude</div>
              <div className="v mono">{fmtCoord(aircraft.lon)}</div>
            </div>

            <div className="hint">
              Tip: Enrich this card with additional backend data (aircraft model, operator, etc.).
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv stat">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
    </div>
  )
}

function AirportCard({
  airport,
  align = 'left',
  label
}: {
  airport: FlightSummaryAirport | null
  align?: 'left' | 'right'
  label: string
}) {
  const subtitle = formatAirportSubtitle(airport)
  return (
    <div className={`airport-card ${align === 'right' ? 'align-right' : ''}`}>
      <span className="airport-card__label">{label}</span>
      <div className="airport-card__code">{airport?.code || '—'}</div>
      <div className="airport-card__name">{subtitle}</div>
    </div>
  )
}

function formatAirportSubtitle(airport: FlightSummaryAirport | null) {
  if (!airport) return 'Unknown'
  if (airport.name) return airport.name
  return [airport.city, airport.country].filter(Boolean).join(', ') || 'Unknown'
}

function formatTime(ts?: number | null) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
