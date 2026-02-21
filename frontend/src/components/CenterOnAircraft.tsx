import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import type { Aircraft } from '../types/aircraft'

export function CenterOnAircraft({ aircraft }: { aircraft: Aircraft | null }) {
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

