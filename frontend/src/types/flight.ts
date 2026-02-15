export type FlightSummaryAirport = {
  code: string | null
  name: string | null
  city: string | null
  country: string | null
  time: number | null
}

export type FlightSummary = {
  departure?: FlightSummaryAirport | null
  arrival?: FlightSummaryAirport | null
}
