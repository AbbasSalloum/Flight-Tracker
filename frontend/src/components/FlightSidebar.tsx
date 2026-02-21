import type { Aircraft } from '../types/aircraft'
import { AircraftList } from './AircraftList'
import { PlaneGlyph, SearchGlyph } from './icons'
import styles from './FlightSidebar.module.css'

export type MobileView = 'list' | 'map'

type FlightSidebarProps = {
  aircraft: Aircraft[]
  selected: Aircraft | null
  onSelect: (plane: Aircraft) => void
  isMobile: boolean
  mobileView: MobileView
  onMobileViewChange: (view: MobileView) => void
  onClose?: () => void
}

export function FlightSidebar({
  aircraft,
  selected,
  onSelect,
  isMobile,
  mobileView,
  onMobileViewChange,
  onClose
}: FlightSidebarProps) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.topbar}>
        <div className={styles.topbarTitle}>
          <span className={styles.appBadge} style={{ color: 'rgba(255,255,255,0.92)' }}>
            <PlaneGlyph />
          </span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Flights</div>
            <div className={styles.smallText}>
              Click a flight to view details
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.iconBtn} aria-label="Search">
            <SearchGlyph />
          </button>
          {!isMobile && onClose && (
            <button className={styles.iconBtn} onClick={onClose} aria-label="Close flights panel">
              &times;
            </button>
          )}
        </div>
      </div>

      {isMobile && (
        <div className={styles.segment} style={{ marginBottom: 10 }}>
          <button
            className={`${styles.segmentButton}${mobileView === 'list' ? ` ${styles.segmentButtonActive}` : ''}`}
            onClick={() => onMobileViewChange('list')}
          >
            List
          </button>
          <button
            className={`${styles.segmentButton}${mobileView === 'map' ? ` ${styles.segmentButtonActive}` : ''}`}
            onClick={() => onMobileViewChange('map')}
          >
            Map
          </button>
        </div>
      )}

      <div className={styles.panelCard}>
        <div className={styles.panelBody}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800 }}>In view</div>
              <div className={styles.smallText}>OpenSky bbox polling &middot; every 8s</div>
            </div>
            <div className={styles.pill}>{aircraft.length}</div>
          </div>
        </div>
      </div>

      <AircraftList aircraft={aircraft} selected={selected} onSelect={onSelect} />
    </div>
  )
}
