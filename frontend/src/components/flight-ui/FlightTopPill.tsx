import type { ReactNode } from 'react'

export type FlightTopPillProps = {
  callsign: string
  subtitle?: string
  onBack: () => void
  onMenu?: () => void
  endSlot?: ReactNode
}

export function FlightTopPill({ callsign, subtitle, onBack, onMenu, endSlot }: FlightTopPillProps) {
  return (
    <div className="ft-topPill" role="region" aria-label="Selected flight">
      <button className="ft-topBtn" type="button" onClick={onBack} aria-label="Close flight">
        ←
      </button>

      <div className="ft-topContent">
        <div className="ft-topTitle">{callsign}</div>
        {subtitle ? <div className="ft-topSubtitle">{subtitle}</div> : null}
      </div>

      {endSlot}

      {onMenu ? (
        <button className="ft-topBtn" type="button" onClick={onMenu} aria-label="Flight actions">
          ⋯
        </button>
      ) : (
        <div className="ft-topBtn ft-topBtn--ghost" aria-hidden="true">
          ⋯
        </div>
      )}
    </div>
  )
}
