type Airport = {
  code?: string | null
  name?: string | null
  city?: string | null
  country?: string | null
  time?: number | null
}

type Props = {
  departure?: Airport | null
  arrival?: Airport | null
  distanceKm?: number
  remainingKm?: number
  progressPct?: number
}

export default function FlightRouteBlock({
  departure,
  arrival,
  distanceKm,
  remainingKm,
  progressPct
}: Props) {
  return (
    <div className="fr24-route">
      <div className="fr24-route__top">
        <AirportBadge airport={departure} />
        <div className="fr24-route__plane">✈</div>
        <AirportBadge airport={arrival} align="right" />
      </div>

      <div className="fr24-route__times">
        <div>
          <span>DEPARTED</span>
          <strong>{formatTime(departure?.time)}</strong>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span>ARRIVING</span>
          <strong>{formatTime(arrival?.time)}</strong>
        </div>
      </div>

      <div className="fr24-route__track">
        <div className="fr24-route__trackFill" style={{ width: `${clamp(progressPct)}%` }} />
      </div>

      <div className="fr24-route__bottom">
        <span>{formatDistance(distanceKm, 'flown')}</span>
        <span>{formatDistance(remainingKm, 'remaining')}</span>
      </div>
    </div>
  )
}

function formatTime(ts?: number | null) {
  if (ts === null || ts === undefined) return '—'
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDistance(value?: number, label?: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value} km ${label ?? ''}`.trim()
}

function clamp(v?: number) {
  if (!v || !Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, v))
}

function formatAirportLabel(airport?: Airport | null) {
  if (!airport) return '—'
  if (airport.name) return airport.name
  const parts = [airport.city, airport.country].filter(Boolean)
  if (parts.length) return parts.join(', ')
  if (airport.code) return airport.code
  return '—'
}

function AirportBadge({
  airport,
  align = 'left'
}: {
  airport?: Airport | null
  align?: 'left' | 'right'
}) {
  const style = align === 'right' ? { textAlign: 'right' as const } : undefined
  return (
    <div className="fr24-route__airport" style={style}>
      <div className="fr24-route__code">{airport?.code || '—'}</div>
      <div className="fr24-route__label">{formatAirportLabel(airport)}</div>
    </div>
  )
}
