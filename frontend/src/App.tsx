import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LatLngBounds } from 'leaflet'
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet'
import './App.css'

import AircraftMarker, { type Aircraft } from './components/AircraftMarker'
import SelectedAircraftPanel from './components/SelectedAircraftPanel'

function BoundsPoller({ onData }: { onData: (a: Aircraft[]) => void }) {
  const timer = useRef<number | null>(null)

  const fetchForBounds = useCallback(async (bounds: LatLngBounds) => {
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()

    const url = `http://localhost:8080/api/airspace?lamin=${sw.lat}&lomin=${sw.lng}&lamax=${ne.lat}&lomax=${ne.lng}`

    const r = await fetch(url)
    const data = await r.json()
    onData(data.aircraft || [])
  }, [onData])

  const map = useMapEvents({
    moveend(e) {
      fetchForBounds(e.target.getBounds())
    },
    zoomend(e) {
      fetchForBounds(e.target.getBounds())
    }
  })

  useEffect(() => {
    if (!map) return undefined

    let cancelled = false
    const run = () => fetchForBounds(map.getBounds())

    map.whenReady(() => {
      if (cancelled) return

      run()
      timer.current = window.setInterval(run, 8000)
    })

    return () => {
      cancelled = true
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [map, fetchForBounds])

  return null
}

export default function App() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const center = useMemo(() => [43.6532, -79.3832] as [number, number], [])

  const selectedAircraft = useMemo(() => {
    if (!selectedId) return null
    return aircraft.find((a) => a.icao24 === selectedId) ?? null
  }, [aircraft, selectedId])

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw' }}>
      <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <BoundsPoller onData={setAircraft} />

        {aircraft.map((a) => (
          <AircraftMarker key={a.icao24} aircraft={a} onSelect={(aircraft) => setSelectedId(aircraft.icao24)} />
        ))}
      </MapContainer>

      {/* Small HUD */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'white',
          padding: 12,
          borderRadius: 8,
          maxWidth: 360,
          zIndex: 1000
        }}
      >
        <div style={{ fontWeight: 700 }}>Aircraft in view: {aircraft.length}</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Click an aircraft to view details.</div>
      </div>

      {/* Selected aircraft details */}
      {selectedAircraft && (
        <SelectedAircraftPanel aircraft={selectedAircraft} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
