import { useCallback, useEffect, useRef } from 'react'
import type { LatLngBounds } from 'leaflet'
import { useMapEvents } from 'react-leaflet'
import type { Aircraft } from '../types/aircraft'

type BoundsPollerProps = {
  onData: (aircraft: Aircraft[]) => void
}

export function BoundsPoller({ onData }: BoundsPollerProps) {
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
    const run = () => fetchForBounds(map.getBounds())
    run()
    timer.current = window.setInterval(run, 8000)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [map, fetchForBounds])

  return null
}

