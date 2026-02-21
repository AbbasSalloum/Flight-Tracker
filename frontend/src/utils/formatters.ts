import type { Aircraft } from '../types/aircraft'
import type { FlightSummary, FlightSummaryAirport } from '../types/flight'

export function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function formatMaybeNumber(value: number | null | undefined, unit: string, digits = 0) {
  if (!isFiniteNumber(value)) return 'N/A'
  const formatted = digits > 0 ? value.toFixed(digits) : String(Math.round(value))
  return `${formatted} ${unit}`
}

export function formatAirportCodeOrLocation(airport?: FlightSummaryAirport | null) {
  if (!airport) return null
  if (airport.code) return airport.code.toUpperCase()
  if (airport.city && airport.country) return `${airport.city}, ${airport.country}`
  return airport.city || airport.country || null
}

export function formatAirportDetail(airport?: FlightSummaryAirport | null) {
  if (!airport) return 'Unknown'
  const code = airport.code?.toUpperCase()
  if (code) return code
  if (airport.name) return airport.name
  if (airport.city && airport.country) return `${airport.city}, ${airport.country}`
  return airport.city || airport.country || 'Unknown'
}

export function buildSubtitle(aircraft: Aircraft, summary: FlightSummary | null) {
  const dep = formatAirportCodeOrLocation(summary?.departure)
  const arr = formatAirportCodeOrLocation(summary?.arrival)
  if (dep && arr) return `${dep} \u2192 ${arr}`
  if (dep) return `${dep} departure`
  if (arr) return `Arriving at ${arr}`
  return aircraft.originCountry || 'Unknown origin'
}

