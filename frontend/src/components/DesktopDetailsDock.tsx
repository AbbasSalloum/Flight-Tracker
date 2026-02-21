import type { Aircraft } from '../types/aircraft'
import type { FlightSummary } from '../types/flight'
import { buildSubtitle } from '../utils/formatters'
import { AircraftDetails } from './AircraftDetails'
import { DotsGlyph, PlaneGlyph } from './icons'
import styles from './DesktopDetailsDock.module.css'

type DesktopDetailsDockProps = {
  selected: Aircraft | null
  flightSummary: FlightSummary | null
  onClearSelection: () => void
}

export function DesktopDetailsDock({ selected, flightSummary, onClearSelection }: DesktopDetailsDockProps) {
  return (
    <div className={styles.detailsDock}>
      <div className={styles.topbar}>
        <div className={styles.topbarTitle}>
          <span className={styles.appBadge} style={{ color: 'rgba(255,255,255,0.92)' }}>
            <PlaneGlyph />
          </span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Aircraft</div>
            <div className={styles.smallText}>Details panel</div>
          </div>
        </div>
        <button className={styles.iconBtn} aria-label="More">
          <DotsGlyph />
        </button>
      </div>

      <div className={styles.panelCard}>
        <div className={styles.panelBody}>
          {!selected ? (
            <div className={styles.muted}>
              Select an aircraft from the list or click a marker on the map.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontWeight: 850, fontSize: 16 }}>
                    {selected.callsign || selected.icao24}
                  </div>
                  <div className={styles.smallText}>{buildSubtitle(selected, flightSummary)}</div>
                </div>
                <button className={styles.iconBtn} onClick={onClearSelection} aria-label="Clear selection">
                  &times;
                </button>
              </div>

              <div style={{ marginTop: 10 }}>
                <AircraftDetails aircraft={selected} summary={flightSummary} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
