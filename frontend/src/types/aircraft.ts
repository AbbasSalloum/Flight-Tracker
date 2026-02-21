export type Aircraft = {
  icao24: string
  callsign: string | null
  lat: number
  lon: number
  baroAltitude: number | null
  velocity: number | null
  trueTrack: number | null
  onGround: boolean
  originCountry: string
}

