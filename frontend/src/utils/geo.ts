export function projectForward(start: [number, number], headingDeg: number, distanceKm: number) {
  const [lat, lon] = start
  const R = 6371
  const d = distanceKm / R
  const heading = (headingDeg * Math.PI) / 180
  const latRad = (lat * Math.PI) / 180
  const lonRad = (lon * Math.PI) / 180

  const newLat = Math.asin(
    Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(heading)
  )
  const newLon =
    lonRad +
    Math.atan2(
      Math.sin(heading) * Math.sin(d) * Math.cos(latRad),
      Math.cos(d) - Math.sin(latRad) * Math.sin(newLat)
    )

  return [(newLat * 180) / Math.PI, ((newLon * 180) / Math.PI + 540) % 360 - 180] as [number, number]
}

