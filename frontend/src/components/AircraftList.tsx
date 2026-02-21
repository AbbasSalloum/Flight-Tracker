import { useMemo } from 'react'
import type { Aircraft } from '../types/aircraft'
import { formatMaybeNumber } from '../utils/formatters'
import { PlaneGlyph } from './icons'
import styles from './AircraftList.module.css'

type AircraftListProps = {
  aircraft: Aircraft[]
  selected: Aircraft | null
  onSelect: (aircraft: Aircraft) => void
}

export function AircraftList({ aircraft, selected, onSelect }: AircraftListProps) {
  const sorted = useMemo(() => {
    return [...aircraft].sort((a, b) => {
      if (a.onGround !== b.onGround) return a.onGround ? 1 : -1
      const aa = a.baroAltitude ?? -1
      const bb = b.baroAltitude ?? -1
      if (aa !== bb) return bb - aa
      return (a.callsign || a.icao24).localeCompare(b.callsign || b.icao24)
    })
  }, [aircraft])

  return (
    <div className={styles.list}>
      {sorted.map((plane) => {
        const isActive = selected?.icao24 === plane.icao24
        const leftCode = airportCodeFromCountry(plane.originCountry)
        const rightCode = ((plane.callsign || plane.icao24).slice(0, 3).toUpperCase()) || 'FLY'

        return (
          <div
            key={plane.icao24}
            className={styles.listItem}
            style={{
              outline: isActive ? '2px solid rgba(255, 179, 0, 0.45)' : 'none'
            }}
            onClick={() => onSelect(plane)}
            role="button"
            tabIndex={0}
          >
            <div className={styles.listRowTop}>
              <div className={styles.callsignPill}>
                <span className={styles.airlineDot} style={{ color: 'rgba(255,255,255,0.92)' }}>
                  <PlaneGlyph />
                </span>
                <span>{plane.callsign || plane.icao24}</span>
              </div>

              <div className={styles.metaPills}>
                <span className={styles.pill}>{plane.onGround ? 'Ground' : 'Air'}</span>
                <span className={styles.pill}>{formatMaybeNumber(plane.trueTrack, '°')}</span>
              </div>
            </div>

            <div className={styles.bigCodeRow}>
              <div>
                <div className={styles.smallText}>{plane.originCountry || 'Unknown'}</div>
                <div className={styles.bigCode}>{leftCode}</div>
              </div>
              <div className={styles.arrow} />
              <div style={{ textAlign: 'right' }}>
                <div className={styles.smallText}>Callsign</div>
                <div className={styles.bigCode}>{rightCode}</div>
              </div>
            </div>

            <div style={{ marginTop: 10 }} className={styles.smallText}>
              Alt: <kbd>{formatMaybeNumber(plane.baroAltitude, 'm')}</kbd> &middot; Speed: <kbd>{formatMaybeNumber(plane.velocity, 'm/s')}</kbd>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function airportCodeFromCountry(country: string) {
  const cleaned = (country || 'UNK').replace(/[^A-Za-z]/g, '').toUpperCase()
  const a = (cleaned[0] || 'U') + (cleaned[Math.floor(cleaned.length / 2)] || 'N') + (cleaned[cleaned.length - 1] || 'K')
  return a.slice(0, 3)
}
