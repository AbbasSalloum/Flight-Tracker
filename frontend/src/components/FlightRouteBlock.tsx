type Props = {
  from?: string | null
  to?: string | null
  departedAt?: number | null
  distanceKm?: number
  remainingKm?: number
  progressPct?: number
}

export default function FlightRouteBlock({
  from,
  to,
  departedAt,
  distanceKm,
  remainingKm,
  progressPct
}: Props) {
  return (
    <div className="fr24-route">
      <div className="fr24-route__top">
        <div className="fr24-route__code">{from || '—'}</div>
        <div className="fr24-route__plane">✈</div>
        <div className="fr24-route__code">{to || '—'}</div>
      </div>

      <div className="fr24-route__times">
        <span>DEPARTED</span>
        <strong>{departedAt ? formatTime(departedAt) : '—'}</strong>
      </div>

      <div className="fr24-route__track">
        <div className="fr24-route__trackFill" style={{ width: `${clamp(progressPct)}%` }} />
      </div>

      <div className="fr24-route__bottom">
        <span>{distanceKm ? `${distanceKm} km flown` : '—'}</span>
        <span>{remainingKm ? `${remainingKm} km remaining` : '—'}</span>
      </div>
    </div>
  )
}

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function clamp(v?: number) {
  if (!v || !Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, v))
}
