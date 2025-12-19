import { useEffect, useMemo, useRef, useState } from 'react'
import type { LatLngBounds } from 'leaflet'
import { CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import './App.css'

type Aircraft = {
  icao24: string
  callsign: string
  lat: number
  lon: number
  baroAltitude: number | null
  velocity: number | null
  trueTrack: number | null
  onGround: boolean
  originCountry: string
}

function BoundsPoller({ onData }: { onData: (a: Aircraft[]) => void }) {
  const timer = useRef<number | null>(null)

  const fetchForBounds = async (bounds: LatLngBounds) => {
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    const url = `http://localhost:8080/api/airspace?lamin=${sw.lat}&lomin=${sw.lng}&lamax=${ne.lat}&lomax=${ne.lng}`
    const r = await fetch(url)
    const data = await r.json()
    onData(data.aircraft || [])
  }

  useMapEvents({
    moveend(e) {
      fetchForBounds(e.target.getBounds())
    },
    zoomend(e) {
      fetchForBounds(e.target.getBounds())
    }
  })

  const map = useMapEvents({})
  useEffect(() => {
    const run = () => fetchForBounds(map.getBounds())
    run()

    timer.current = window.setInterval(run, 8000)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [map])

  return null
}

export default function App() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([])
  const center = useMemo(() => [43.6532, -79.3832] as [number, number], [])

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <BoundsPoller onData={setAircraft} />
        {aircraft.map((plane) => (
          <CircleMarker
            key={plane.icao24}
            center={[plane.lat, plane.lon]}
            radius={6}
            pathOptions={{ color: plane.onGround ? '#ff9800' : '#1e88e5', weight: 1, fillOpacity: 0.8 }}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 600 }}>{plane.callsign || plane.icao24}</div>
                <div>Country: {plane.originCountry}</div>
                <div>Altitude: {plane.baroAltitude ? `${Math.round(plane.baroAltitude)} m` : 'N/A'}</div>
                <div>Speed: {plane.velocity ? `${Math.round(plane.velocity)} m/s` : 'N/A'}</div>
                <div>Heading: {plane.trueTrack ? `${Math.round(plane.trueTrack)}°` : 'N/A'}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          background: 'white',
          padding: 12,
          borderRadius: 8,
          maxWidth: 360
        }}
      >
        <div style={{ fontWeight: 700 }}>Aircraft in view: {aircraft.length}</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Tip: zoom in if count is huge.</div>
      </div>
    </div>
  )
}
