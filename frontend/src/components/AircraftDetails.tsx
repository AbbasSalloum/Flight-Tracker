import type { Aircraft } from '../types/aircraft'
import type { FlightSummary } from '../types/flight'
import { formatAirportDetail, formatMaybeNumber } from '../utils/formatters'
import styles from './AircraftDetails.module.css'

type AircraftDetailsProps = {
  aircraft: Aircraft
  summary: FlightSummary | null
}

export function AircraftDetails({ aircraft, summary }: AircraftDetailsProps) {
  const departureLabel = formatAirportDetail(summary?.departure)
  const destinationLabel = formatAirportDetail(summary?.arrival)
  const destinationCountry = summary?.arrival?.country || 'Unknown'
  return (
    <div className={styles.detailGrid}>
      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Speed</div>
          <div className={styles.kpiValue}>{formatMaybeNumber(aircraft.velocity, 'm/s')}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Altitude</div>
          <div className={styles.kpiValue}>{formatMaybeNumber(aircraft.baroAltitude, 'm')}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Heading</div>
          <div className={styles.kpiValue}>{formatMaybeNumber(aircraft.trueTrack, '°')}</div>
        </div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.key}>Callsign</div>
        <div className={styles.value}>{aircraft.callsign || 'N/A'}</div>
      </div>
      <div className={styles.detailRow}>
        <div className={styles.key}>ICAO24</div>
        <div className={styles.value}>{aircraft.icao24}</div>
      </div>
      <div className={styles.detailRow}>
        <div className={styles.key}>Origin Country</div>
        <div className={styles.value}>{aircraft.originCountry || 'Unknown'}</div>
      </div>
      <div className={styles.detailRow}>
        <div className={styles.key}>Departure</div>
        <div className={styles.value}>{departureLabel}</div>
      </div>
      <div className={styles.detailRow}>
        <div className={styles.key}>Destination</div>
        <div className={styles.value}>{destinationLabel}</div>
      </div>
      <div className={styles.detailRow}>
        <div className={styles.key}>Destination Country</div>
        <div className={styles.value}>{destinationCountry}</div>
      </div>
      <div className={styles.detailRow}>
        <div className={styles.key}>Status</div>
        <div className={styles.value}>{aircraft.onGround ? 'On ground' : 'Airborne'}</div>
      </div>
      <div className={styles.detailRow}>
        <div className={styles.key}>Coordinates</div>
        <div className={styles.value}>
          {aircraft.lat.toFixed(4)}, {aircraft.lon.toFixed(4)}
        </div>
      </div>
    </div>
  )
}
