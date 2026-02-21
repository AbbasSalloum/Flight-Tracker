import { useEffect, useMemo, useState } from 'react'
import type { Aircraft } from '../types/aircraft'
import type { FlightSummary } from '../types/flight'
import { isFiniteNumber } from '../utils/formatters'
import { projectForward } from '../utils/geo'

export function useFlightDetails(selected: Aircraft | null) {
  const [flightPath, setFlightPath] = useState<[number, number][]>([])
  const [flightSummary, setFlightSummary] = useState<FlightSummary | null>(null)

  useEffect(() => {
    if (!selected) {
      setFlightPath([])
      setFlightSummary(null)
      return
    }

    let cancelled = false
    const fetchTrackAndSummary = async () => {
      try {
        const trackUrl = `http://localhost:8080/api/flight/track?icao24=${selected.icao24}`
        const params = new URLSearchParams({ icao24: selected.icao24 })
        const trimmedCallsign = selected.callsign?.trim()
        if (trimmedCallsign) params.set('callsign', trimmedCallsign)
        const summaryUrl = `http://localhost:8080/api/flight/summary?${params.toString()}`

        const [trackRes, summaryRes] = await Promise.all([
          fetch(trackUrl),
          fetch(summaryUrl)
        ])

        let nextPath: [number, number][] = []
        if (trackRes.ok) {
          const data = await trackRes.json()
          const rawPath = Array.isArray(data.path) ? data.path : []
          for (const point of rawPath) {
            if (
              Array.isArray(point) &&
              Number.isFinite(point[0]) &&
              Number.isFinite(point[1])
            ) {
              nextPath.push([point[0], point[1]])
            }
          }
        }

        let summary: FlightSummary | null = null
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json()
          if (summaryData && typeof summaryData === 'object') {
            summary = {
              departure: summaryData.departure || null,
              arrival: summaryData.arrival || null
            }
          }
        }

        if (!cancelled) {
          setFlightPath(nextPath)
          setFlightSummary(summary)
        }
      } catch {
        if (!cancelled) {
          setFlightPath([])
          setFlightSummary(null)
        }
      }
    }
    fetchTrackAndSummary()
    return () => {
      cancelled = true
    }
  }, [selected])

  const projectedPath = useMemo(() => {
    if (!selected) return []
    if (!isFiniteNumber(selected.lat) || !isFiniteNumber(selected.lon)) return []
    const heading = selected.trueTrack
    if (!isFiniteNumber(heading)) return []
    const start: [number, number] = [selected.lat, selected.lon]
    const end = projectForward(start, heading, 80)
    return [start, end]
  }, [selected])

  return { flightPath, flightSummary, projectedPath }
}

