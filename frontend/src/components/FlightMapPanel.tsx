import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet'
import type { Aircraft } from '../types/aircraft'
import type { FlightSummary } from '../types/flight'
import { getPlaneIcon } from '../icons/getPlaneIcon'
import { BoundsPoller } from './BoundsPoller'
import { CenterOnAircraft } from './CenterOnAircraft'
import { MobileSelectionSheet } from './MobileSelectionSheet'
import { DotsGlyph, PlaneGlyph, SearchGlyph } from './icons'
import styles from './FlightMapPanel.module.css'

type FlightMapPanelProps = {
  center: [number, number]
  aircraft: Aircraft[]
  selected: Aircraft | null
  flightPath: [number, number][]
  projectedPath: [number, number][]
  flightSummary: FlightSummary | null
  onAircraftUpdate: (next: Aircraft[]) => void
  onSelect: (plane: Aircraft) => void
  onClearSelection: () => void
  isMobile: boolean
}

export function FlightMapPanel({
  center,
  aircraft,
  selected,
  flightPath,
  projectedPath,
  flightSummary,
  onAircraftUpdate,
  onSelect,
  onClearSelection,
  isMobile
}: FlightMapPanelProps) {
  return (
    <div className={styles.mainMap}>
      <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }} className={styles.mapDark}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <BoundsPoller onData={onAircraftUpdate} />
        <CenterOnAircraft aircraft={selected} />

        {aircraft.map((plane) => {
          const icon = getPlaneIcon(plane.trueTrack, plane.onGround)
          return (
            <Marker
              key={plane.icao24}
              position={[plane.lat, plane.lon]}
              icon={icon}
              eventHandlers={{
                click: () => onSelect(plane)
              }}
            />
          )
        })}

        {selected && flightPath.length > 1 && (
          <Polyline
            key="past-path"
            positions={flightPath}
            pathOptions={{
              color: '#ffb300',
              weight: 3,
              opacity: 0.9
            }}
          />
        )}

        {projectedPath.length > 1 && (
          <Polyline
            key="future-path"
            positions={projectedPath}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              opacity: 0.8,
              dashArray: '6 8'
            }}
          />
        )}
      </MapContainer>

      <div className={styles.mapOverlayTop}>
        <div className={styles.mapOverlayTopInner}>
          <div className={styles.topbar} style={{ width: '100%' }}>
            <div className={styles.topbarTitle}>
              <span className={styles.appBadge} style={{ color: 'rgba(255,255,255,0.92)' }}>
                <PlaneGlyph />
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Flights</div>
                <div className={styles.smallText}>{aircraft.length} aircraft in view</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className={styles.iconBtn} aria-label="Search">
                <SearchGlyph />
              </button>
              <button className={styles.iconBtn} aria-label="More">
                <DotsGlyph />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isMobile && (
        <MobileSelectionSheet
          selected={selected}
          flightSummary={flightSummary}
          onClose={onClearSelection}
        />
      )}
    </div>
  )
}
