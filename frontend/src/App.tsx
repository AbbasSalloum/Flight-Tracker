import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { DesktopDetailsDock } from './components/DesktopDetailsDock'
import { FlightMapPanel } from './components/FlightMapPanel'
import { FlightSidebar, type MobileView } from './components/FlightSidebar'
import { useFlightDetails } from './hooks/useFlightDetails'
import { useMediaQuery } from './hooks/useMediaQuery'
import type { Aircraft } from './types/aircraft'

export default function App() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([])
  const [selected, setSelected] = useState<Aircraft | null>(null)
  const { flightPath, flightSummary, projectedPath } = useFlightDetails(selected)
  const isMobile = useMediaQuery('(max-width: 900px)')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileView, setMobileView] = useState<MobileView>('map')
  const center = useMemo(() => [43.6532, -79.3832] as [number, number], [])

  const onSelect = (plane: Aircraft) => {
    setSelected(plane)
    if (isMobile) setMobileView('map')
  }

  const clearSelection = () => setSelected(null)

  useEffect(() => {
    if (!selected) return
    const stillVisible = aircraft.some((plane) => plane.icao24 === selected.icao24)
    if (!stillVisible) setSelected(null)
  }, [aircraft, selected])

  useEffect(() => {
    if (isMobile) setSidebarOpen(true)
  }, [isMobile])

  const mapProps = {
    center,
    aircraft,
    selected,
    flightPath,
    projectedPath,
    flightSummary,
    onAircraftUpdate: setAircraft,
    onSelect,
    onClearSelection: clearSelection
  }

  if (isMobile) {
    return (
      <div className="appShell">
        {mobileView === 'list' ? (
          <FlightSidebar
            aircraft={aircraft}
            selected={selected}
            onSelect={onSelect}
            isMobile
            mobileView={mobileView}
            onMobileViewChange={setMobileView}
          />
        ) : (
          <FlightMapPanel
            {...mapProps}
            isMobile
          />
        )}
      </div>
    )
  }

  return (
    <div className="appShell">
      <div className={`desktopGrid${sidebarOpen ? '' : ' desktopGridCollapsed'}`}>
        {sidebarOpen && (
          <FlightSidebar
            aircraft={aircraft}
            selected={selected}
            onSelect={onSelect}
            isMobile={false}
            mobileView={mobileView}
            onMobileViewChange={setMobileView}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        <FlightMapPanel
          {...mapProps}
          isMobile={false}
        />
        <DesktopDetailsDock
          selected={selected}
          flightSummary={flightSummary}
          onClearSelection={clearSelection}
        />
      </div>
      {!sidebarOpen && (
        <button className="sidebarToggle" onClick={() => setSidebarOpen(true)}>
          Show flights
        </button>
      )}
    </div>
  )
}
