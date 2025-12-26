import type { Aircraft } from './AircraftMarker'
import './SelectedAircraftPanel.css'

const POSITION_SOURCES = ['ADS-B', 'ASTERIX', 'MLAT'] as const

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

export default function SelectedAircraftPanel({
  aircraft,
  onClose
}: {
  aircraft: Aircraft
  onClose: () => void
}) {
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
