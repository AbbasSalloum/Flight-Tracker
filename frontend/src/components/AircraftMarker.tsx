import { Marker } from 'react-leaflet'
import { getPlaneIcon } from '../icons/getPlaneIcon'

export type Aircraft = {
  icao24: string
  callsign: string
  lat: number
  lon: number
  baroAltitude: number | null
  velocity: number | null
  trueTrack: number | null
  verticalRate?: number | null
  geoAltitude?: number | null
  squawk?: string | null
  positionSource?: number | null
  timePosition?: number | null
  onGround: boolean
  originCountry: string
  lastContact?: number | null
  distanceFlownKm?: number | null
  remainingKm?: number | null
  progressPct?: number | null
}

export default function AircraftMarker({
  aircraft,
  onSelect,
}: {
  aircraft: Aircraft
  onSelect: (a: Aircraft) => void
}) {
  const icon = getPlaneIcon(aircraft.trueTrack, aircraft.onGround)

  return (
    <Marker
      position={[aircraft.lat, aircraft.lon]}
      icon={icon}
      eventHandlers={{
        click: () => onSelect(aircraft),
      }}
    />
  )
}
