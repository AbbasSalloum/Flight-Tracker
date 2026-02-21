import type { Aircraft } from '../types/aircraft'
import type { FlightSummary } from '../types/flight'
import { buildSubtitle } from '../utils/formatters'
import { AircraftDetails } from './AircraftDetails'
import styles from './MobileSelectionSheet.module.css'

type MobileSelectionSheetProps = {
  selected: Aircraft | null
  flightSummary: FlightSummary | null
  onClose: () => void
}

export function MobileSelectionSheet({ selected, flightSummary, onClose }: MobileSelectionSheetProps) {
  const backdropClass = selected ? `${styles.sheetBackdrop} ${styles.sheetBackdropOpen}` : styles.sheetBackdrop
  const sheetClass = selected ? `${styles.sheet} ${styles.sheetOpen}` : styles.sheet

  return (
    <>
      <div
        className={backdropClass}
        onClick={onClose}
      />
      <div className={sheetClass}>
        <div className={styles.sheetCard}>
          <div className={styles.sheetGrab} />
          <div className={styles.sheetHeader}>
            <div className={styles.sheetTitle}>
              <strong>{selected?.callsign || selected?.icao24 || 'Aircraft'}</strong>
              <span className={styles.sheetSubtitle}>{selected ? `${buildSubtitle(selected, flightSummary)} \u00b7 Tap outside to close` : 'Tap outside to close'}</span>
            </div>
            <button className={styles.iconBtn} onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>

          {selected && <AircraftDetails aircraft={selected} summary={flightSummary} />}
        </div>
      </div>
    </>
  )
}
