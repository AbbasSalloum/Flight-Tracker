import { useEffect, useMemo, useRef, useState } from 'react'
import type { LatLngBounds } from 'leaflet'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'
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

const planeIconCache = new Map<string, ReturnType<typeof divIcon>>()

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeHeading(value: number | null): number {
  if (!isFiniteNumber(value)) return 0
  const heading = value % 360
  return heading < 0 ? heading + 360 : heading
}

function getPlaneIcon(heading: number | null, onGround: boolean) {
  const normalizedHeading = Math.round(normalizeHeading(heading))
  const cacheKey = `${normalizedHeading}:${onGround ? 'ground' : 'air'}`
  const cached = planeIconCache.get(cacheKey)
  if (cached) return cached

  const color = onGround ? '#ff9800' : '#1e88e5'
  const icon = divIcon({
    className: 'plane-icon',
    html: `<div class="plane-icon__wrapper" style="--plane-color: ${color}; transform: rotate(${normalizedHeading}deg);">
        <span class="plane-icon__halo"></span>
        <svg viewBox="0 0 24 24" role="img" aria-label="aircraft icon">
          <path d="M2.5 12.5h8.2l-1.8-7.8h2l3 7.8H21l0.9 1.8h-7.9l1.8 6.7h-2l-2.8-6.7H5z" />
        </svg>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -12]
  })
  planeIconCache.set(cacheKey, icon)
  return icon
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
        {aircraft.map((plane) => {
          const icon = getPlaneIcon(plane.trueTrack, plane.onGround)

          return (
            <Marker key={plane.icao24} position={[plane.lat, plane.lon]} icon={icon}>
              <Popup>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{plane.callsign || plane.icao24}</div>
                  <div>Country: {plane.originCountry}</div>
                  <div>Altitude: {plane.baroAltitude ? `${Math.round(plane.baroAltitude)} m` : 'N/A'}</div>
                  <div>Speed: {plane.velocity ? `${Math.round(plane.velocity)} m/s` : 'N/A'}</div>
                  <div>Heading: {plane.trueTrack ? `${Math.round(plane.trueTrack)}°` : 'N/A'}</div>
                </div>
              </Popup>
            </Marker>
          )
        })}
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
