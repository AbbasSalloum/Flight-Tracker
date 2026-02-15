export type FlightDetails = {
  callsign: string
  fromIata: string
  fromCity: string
  fromTz?: string
  toIata: string
  toCity: string
  toTz?: string
  scheduledDep?: string
  actualDep?: string
  scheduledArr?: string
  estimatedArr?: string
}

export type FlightTab = 'Flight' | 'Live' | 'Aircraft'

export type FlightDetailsSheetProps = {
  flight: FlightDetails
  tab: FlightTab
  onTabChange: (tab: FlightTab) => void
  onNotify?: () => void
  onShare?: () => void
}

export function FlightDetailsSheet({ flight, tab, onTabChange, onNotify, onShare }: FlightDetailsSheetProps) {
  return (
    <div className="ft-sheet" role="dialog" aria-label="Flight details">
      <div className="ft-grabber" aria-hidden="true" />

      <div className="ft-tabs" role="tablist" aria-label="Flight info filters">
        {(['Flight', 'Live', 'Aircraft'] as FlightTab[]).map((label) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={tab === label}
            className={`ft-tab ${tab === label ? 'is-active' : ''}`}
            onClick={() => onTabChange(label)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="ft-card">
        <div className="ft-routeRow">
          <div className="ft-airport">
            <div className="ft-iata">{flight.fromIata}</div>
            <div className="ft-city">{flight.fromCity}</div>
            {flight.fromTz ? <div className="ft-tz">{flight.fromTz}</div> : null}
          </div>
          <div className="ft-routeMid" aria-hidden="true">
            <div className="ft-routeCircle">
              <span className="ft-plane">✈</span>
            </div>
            <div className="ft-routeLine" />
          </div>
          <div className="ft-airport right">
            <div className="ft-iata">{flight.toIata}</div>
            <div className="ft-city">{flight.toCity}</div>
            {flight.toTz ? <div className="ft-tz">{flight.toTz}</div> : null}
          </div>
        </div>

        <div className="ft-divider" />

        <div className="ft-grid">
          <div className="ft-cell">
            <div className="ft-label">Departure</div>
            <div className="ft-value">{flight.scheduledDep ?? '—'}</div>
          </div>
          <div className="ft-cell">
            <div className="ft-label">Arrival</div>
            <div className="ft-value">{flight.scheduledArr ?? '—'}</div>
          </div>
          <div className="ft-cell">
            <div className="ft-label">Actual</div>
            <div className="ft-value">{flight.actualDep ?? '—'}</div>
          </div>
          <div className="ft-cell">
            <div className="ft-label">Estimated</div>
            <div className="ft-value">
              <span className="ft-dot" aria-hidden="true" />
              {flight.estimatedArr ?? '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="ft-actions">
        <button className="ft-iconBtn" type="button" onClick={onShare} aria-label="Share flight">
          ⤴
        </button>
        <button className="ft-cta" type="button" onClick={onNotify}>
          <span className="ft-bell" aria-hidden="true">
            🔔
          </span>
          Receive notifications
        </button>
      </div>
    </div>
  )
}
