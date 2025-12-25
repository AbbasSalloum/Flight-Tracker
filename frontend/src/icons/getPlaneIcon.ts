import { divIcon } from 'leaflet'

const planeIconCache = new Map<string, ReturnType<typeof divIcon>>()

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeHeading(value: number | null): number {
  if (!isFiniteNumber(value)) return 0
  const heading = value % 360
  return heading < 0 ? heading + 360 : heading
}

export function getPlaneIcon(heading: number | null, onGround: boolean) {
  const h = Math.round(normalizeHeading(heading))
  const cacheKey = `${h}:${onGround ? 'g' : 'a'}`
  const cached = planeIconCache.get(cacheKey)
  if (cached) return cached

  const icon = divIcon({
    className: 'plane-min',
    html: `
      <div class="plane-min__wrap ${onGround ? 'is-ground' : 'is-air'}" style="transform: rotate(${h}deg);">
        <div class="plane-min__pin"></div>
        <div class="plane-min__arrow"></div>
      </div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  })

  planeIconCache.set(cacheKey, icon)
  return icon
}
