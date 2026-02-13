import { divIcon } from 'leaflet'

const cache = new Map<string, ReturnType<typeof divIcon>>()

function normalizeRotation(track: number | null) {
  if (typeof track !== 'number' || !Number.isFinite(track)) return 0
  const h = track % 360
  return h < 0 ? h + 360 : h
}

export function getPlaneIcon(track: number | null, onGround: boolean) {
  const rotation = normalizeRotation(track)
  const color = onGround ? '#999999' : '#FFD400'
  const key = `${rotation}:${color}`
  const cached = cache.get(key)
  if (cached) return cached

  const icon = divIcon({
    className: '',
    html: `
      <div style="
        transform: rotate(${rotation}deg);
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="${color}">
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9L2 14v2l8-2.5V20l-2 1.5V23l3.5-1 3.5 1v-1.5L13 20v-6.5L21 16z"/>
        </svg>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })

  cache.set(key, icon)
  return icon
}
