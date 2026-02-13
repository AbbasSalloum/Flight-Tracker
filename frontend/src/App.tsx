import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LatLngBounds } from 'leaflet'
import { MapContainer, Polyline, TileLayer, useMapEvents } from 'react-leaflet'
import './App.css'

import AircraftMarker, { type Aircraft } from './components/AircraftMarker'
import FlightBottomSheet, { type FlightSummary } from './components/FlightBottomSheet'

function MapClickCloser({ onClick }: { onClick: () => void }) {
  useMapEvents({
    click() {
      onClick()
    }
  })

  return null
}

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
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null)
  const [flightPath, setFlightPath] = useState<[number, number][]>([])
  const [flightSummary, setFlightSummary] = useState<FlightSummary | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const center = useMemo(() => [43.6532, -79.3832] as [number, number], [])

  const closeSheet = useCallback(() => {
    setSheetOpen(false)
  }, [])

  useEffect(() => {
    if (sheetOpen) return undefined
    if (!selectedAircraft) {
      setFlightPath([])
      setFlightSummary(null)
      return undefined
    }

    const timer = window.setTimeout(() => {
      setSelectedAircraft(null)
      setFlightPath([])
      setFlightSummary(null)
    }, 240)

    return () => window.clearTimeout(timer)
  }, [sheetOpen, selectedAircraft])

  const handleAircraftSelect = useCallback(async (plane: Aircraft) => {
    setSelectedAircraft(plane)
    setSheetOpen(true)
    setFlightPath([])
    setFlightSummary(null)

    try {
      const [trackResponse, summaryResponse] = await Promise.all([
        fetch(`http://localhost:8080/api/flight/track?icao24=${plane.icao24}`),
        fetch(buildSummaryUrl(plane))
      ])

      if (trackResponse.ok) {
        const trackData = await trackResponse.json()
        setFlightPath(trackData?.path || [])
      } else {
        setFlightPath([])
      }

      if (summaryResponse.ok) {
        const summaryData = (await summaryResponse.json()) as FlightSummary | null
        setFlightSummary(summaryData ?? null)
      } else {
        setFlightSummary(null)
      }
    } catch {
      setFlightPath([])
      setFlightSummary(null)
    }
  }, [])

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw' }}>
      <MapContainer
        center={center}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        className="map-dim"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickCloser
          onClick={() => {
            closeSheet()
          }}
        />
        <BoundsPoller onData={setAircraft} />

        {aircraft.map((a) => (
          <AircraftMarker key={a.icao24} aircraft={a} onSelect={handleAircraftSelect} />
        ))}

        {flightPath.length > 1 && (
          <Polyline
            positions={flightPath}
            pathOptions={{
              color: '#f2b400',
              weight: 3,
              opacity: 0.9
            }}
          />
        )}
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
      <FlightBottomSheet
        aircraft={selectedAircraft}
        open={sheetOpen}
        summary={flightSummary}
        onClose={closeSheet}
      />
    </div>
  )
}

function buildSummaryUrl(aircraft: Aircraft) {
  const params = new URLSearchParams({ icao24: aircraft.icao24 })
  const callsign = aircraft.callsign?.trim()
  if (callsign) params.set('callsign', callsign)
  return `http://localhost:8080/api/flight/summary?${params.toString()}`
}
