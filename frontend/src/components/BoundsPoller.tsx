import { useCallback, useEffect, useRef } from 'react'
import type { LatLngBounds } from 'leaflet'
import { useMapEvents } from 'react-leaflet'
import type { Aircraft } from '../types/aircraft'

type BoundsPollerProps = {
  onData: (aircraft: Aircraft[]) => void
}

export function BoundsPoller({ onData }: BoundsPollerProps) {
  const timer = useRef<number | null>(null)
  const activeController = useRef<AbortController | null>(null)

  const fetchForBounds = useCallback(async (bounds: LatLngBounds) => {
    if (activeController.current) {
      activeController.current.abort()
    }
    const controller = new AbortController()
    activeController.current = controller

    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    const url = `/api/airspace?lamin=${sw.lat}&lomin=${sw.lng}&lamax=${ne.lat}&lomax=${ne.lng}`
    try {
      const r = await fetch(url, { signal: controller.signal })
      if (!r.ok) throw new Error(`HTTP error ${r.status}`)
      const data = await r.json()
      if (!controller.signal.aborted) {
        onData(data.aircraft || [])
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching airspace:', err)
      }
    }
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
      if (activeController.current) activeController.current.abort()
    }
  }, [map, fetchForBounds])

  return null
}

