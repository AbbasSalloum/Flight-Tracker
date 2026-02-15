import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LatLngBounds } from 'leaflet'
import { MapContainer, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import './App.css'

import AircraftMarker, { type Aircraft } from './components/AircraftMarker'
import { FlightDetailsSheet, type FlightDetails, type FlightTab } from './components/flight-ui/FlightDetailsSheet'
import { FlightTopPill } from './components/flight-ui/FlightTopPill'
import './components/flight-ui/flight-ui.css'
import type { FlightSummary } from './types/flight'

function MapClickCloser({ onClick }: { onClick: () => void }) {
  useMapEvents({
    click() {
      onClick()
    }
  })

  return null
}

function CenterOnAircraft({ aircraft }: { aircraft: Aircraft | null }) {
  const map = useMap()
  const lastCentered = useRef<string | null>(null)

  useEffect(() => {
    if (!map) return
    if (!aircraft) {
      lastCentered.current = null
      return
    }
    if (!Number.isFinite(aircraft.lat) || !Number.isFinite(aircraft.lon)) return
    if (lastCentered.current === aircraft.icao24) return

    lastCentered.current = aircraft.icao24
    map.flyTo([aircraft.lat, aircraft.lon], map.getZoom(), {
      duration: 0.8,
      easeLinearity: 0.25
    })
  }, [map, aircraft])

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
  const [flightTab, setFlightTab] = useState<FlightTab>('Flight')
  const closingTimer = useRef<number | null>(null)
  const center = useMemo(() => [43.6532, -79.3832] as [number, number], [])

  const cancelClosingTimer = useCallback(() => {
    if (closingTimer.current) {
      window.clearTimeout(closingTimer.current)
      closingTimer.current = null
    }
  }, [])

  const clearFlightData = useCallback(() => {
    setSelectedAircraft(null)
    setFlightPath([])
    setFlightSummary(null)
  }, [])

  const closeSheet = useCallback(() => {
    cancelClosingTimer()
    setSheetOpen(false)
    setFlightTab('Flight')
    closingTimer.current = window.setTimeout(() => {
      clearFlightData()
      closingTimer.current = null
    }, 240)
  }, [cancelClosingTimer, clearFlightData])

  useEffect(() => () => cancelClosingTimer(), [cancelClosingTimer])

  const handleAircraftSelect = useCallback(async (plane: Aircraft) => {
    cancelClosingTimer()
    setSelectedAircraft(plane)
    setSheetOpen(true)
    setFlightTab('Flight')
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
  }, [cancelClosingTimer])

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
        <CenterOnAircraft aircraft={selectedAircraft} />

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

      {/* Floating HUD */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'rgba(7, 10, 18, 0.85)',
          color: '#fff',
          padding: 12,
          borderRadius: 12,
          maxWidth: 360,
          zIndex: 1000,
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <div style={{ fontWeight: 700 }}>Aircraft in view: {aircraft.length}</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Tap a plane to open the flight card.</div>
      </div>

      {sheetOpen && selectedAircraft ? (
        <>
          <div
            style={{
              position: 'fixed',
              top: 14,
              left: 0,
              right: 0,
              padding: '0 12px',
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 1200
            }}
          >
            <FlightTopPill
              callsign={buildCallsign(selectedAircraft)}
              subtitle={buildSubtitle(selectedAircraft, flightSummary)}
              onBack={closeSheet}
              endSlot={
                <div className="ft-topMeta">
                  <span className="ft-dot" aria-hidden="true" /> {selectedAircraft.onGround ? 'On ground' : 'Airborne'}
                </div>
              }
            />
          </div>

          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 14,
              padding: '0 12px',
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 1200
            }}
          >
            <FlightDetailsSheet
              flight={buildFlightDetails(selectedAircraft, flightSummary)}
              tab={flightTab}
              onTabChange={setFlightTab}
              onNotify={() => console.log('notify')}
              onShare={() => console.log('share')}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

function buildSummaryUrl(aircraft: Aircraft) {
  const params = new URLSearchParams({ icao24: aircraft.icao24 })
  const callsign = aircraft.callsign?.trim()
  if (callsign) params.set('callsign', callsign)
  return `http://localhost:8080/api/flight/summary?${params.toString()}`
}

function buildCallsign(aircraft: Aircraft) {
  return (aircraft.callsign || aircraft.icao24).trim()
}

function buildSubtitle(aircraft: Aircraft, summary: FlightSummary | null) {
  const dep = summary?.departure?.code || summary?.departure?.city
  const arr = summary?.arrival?.code || summary?.arrival?.city
  if (dep && arr) return `${dep} to ${arr}`
  return aircraft.originCountry ? `Origin: ${aircraft.originCountry}` : 'Tracking flight'
}

function formatAirportLabel(airport?: FlightSummary['departure']) {
  if (!airport) return '—'
  if (airport.name) return airport.name
  const parts = [airport.city, airport.country].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

function formatTimeValue(ts?: number | null) {
  if (!ts) return undefined
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function buildFlightDetails(aircraft: Aircraft, summary: FlightSummary | null): FlightDetails {
  return {
    callsign: buildCallsign(aircraft),
    fromIata: summary?.departure?.code?.toUpperCase() || '—',
    fromCity: formatAirportLabel(summary?.departure),
    toIata: summary?.arrival?.code?.toUpperCase() || '—',
    toCity: formatAirportLabel(summary?.arrival),
    scheduledDep: formatTimeValue(summary?.departure?.time),
    scheduledArr: formatTimeValue(summary?.arrival?.time)
  }
}
