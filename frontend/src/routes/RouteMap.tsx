import {
  H,
  W,
  project,
  unproject,
  HARBOR,
  RIVER,
  EASTIE,
  kmToPx,
  geographicPath,
  NEIGHBORHOODS,
} from '../geo'
import { patterns, stops, transitSource, transitDate, routeName, type Site } from './catalog'
import type { Search } from './domain'

const TRANSIT_PILLS = [
  { id: 'all', name: 'All Lines', color: 'var(--brand)' },
  { id: 'Green-B', name: 'Green Line', color: '#00843D', match: (r: string) => r.startsWith('Green') },
  { id: 'Red', name: 'Red Line', color: '#DA291C', match: (r: string) => r === 'Red' },
  { id: 'Orange', name: 'Orange Line', color: '#ED8B00', match: (r: string) => r === 'Orange' },
  { id: 'Blue', name: 'Blue Line', color: '#003DA5', match: (r: string) => r === 'Blue' },
  { id: '741', name: 'Silver Line', color: '#7C878E', match: (r: string) => r === '741' },
  { id: '1', name: 'Bus 1', color: '#b45309', match: (r: string) => r === '1' },
  { id: '39', name: 'Bus 39', color: '#b45309', match: (r: string) => r === '39' },
] as const

export default function RouteMap({
  f,
  sites,
  onSite,
  onOrigin,
  onRouteSelect,
  onResetScope,
}: {
  f: Search
  sites: Site[]
  onSite: (id: string) => void
  onOrigin: (pos: [number, number]) => void
  onRouteSelect?: (routeId: string) => void
  onResetScope?: () => void
}) {
  const isTransit = f.scope === 'transit'
  const isGreen = isTransit && f.route.startsWith('Green')
  const activePatterns = patterns.filter(
    (p) =>
      isTransit &&
      (p.id === f.route || (isGreen && p.id.startsWith('Green'))) &&
      (!f.direction ? p.direction === 0 : p.headsign === f.direction),
  )
  const bgLines = patterns.filter(
    (p) =>
      p.direction === 0 &&
      (!isTransit || (p.id !== f.route && !(isGreen && p.id.startsWith('Green')))),
  )
  const [x, y] = project(...f.origin)

  return (
    <figure className="route-map">
      <div className="map-transit-bar">
        <div className="map-transit-header">
          <div className="map-transit-title-wrap">
            <span className="map-transit-t-badge" aria-hidden="true">
              T
            </span>
            <span className="map-transit-title">Boston Transit & Pantry Map</span>
          </div>
          <span className="map-transit-status">
            {isTransit
              ? `Along ${routeName(f.route)} · ${sites.length} pantries`
              : f.scope === 'radius'
                ? `Within ${f.radius} mi · Tap map to move`
                : `${sites.length} community pantries`}
          </span>
        </div>
        <div className="map-transit-pills" role="toolbar" aria-label="Filter by MBTA transit line">
          {TRANSIT_PILLS.map((pill) => {
            const isActive =
              pill.id === 'all'
                ? f.scope !== 'transit'
                : isTransit && pill.match(f.route)
            return (
              <button
                key={pill.id}
                type="button"
                className={`transit-pill ${isActive ? 'active' : ''}`}
                style={{ '--pill-color': pill.color } as React.CSSProperties}
                onClick={() => {
                  if (pill.id === 'all') {
                    onResetScope?.()
                  } else {
                    onRouteSelect?.(pill.id)
                  }
                }}
              >
                <span className="transit-pill-dot" style={{ backgroundColor: pill.color }} />
                <span>{pill.name}</span>
              </button>
            )
          })}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        className={f.scope === 'radius' ? 'origin-map' : undefined}
        aria-label="Boston demonstration pantries and MBTA routes"
        onClick={(e) => {
          if (f.scope !== 'radius' || (e.target as Element).closest('[data-site]')) return
          const svg = e.currentTarget,
            point = svg.createSVGPoint()
          point.x = e.clientX
          point.y = e.clientY
          const matrix = svg.getScreenCTM()
          if (matrix) {
            const p = point.matrixTransform(matrix.inverse())
            onOrigin(unproject(p.x, p.y))
          }
        }}
      >
        <rect width={W} height={H} fill="var(--map-land)" />
        <path d={HARBOR} fill="var(--map-water)" />
        <path d={EASTIE} fill="var(--map-land)" />
        <path d={RIVER} fill="none" stroke="var(--map-water)" strokeWidth="24" strokeLinecap="round" />
        {NEIGHBORHOODS.map(([name, lat, lng]) => {
          const [a, b] = project(lat, lng)
          return (
            <text x={a} y={b} key={name} textAnchor="middle" className="map-hood">
              {name}
            </text>
          )
        })}
        {/* Background MBTA Transit Network */}
        {bgLines.map((p) => (
          <g key={p.pattern} className="transit-line-bg">
            <path
              d={geographicPath(p.shape as [number, number][])}
              fill="none"
              stroke="var(--card)"
              strokeWidth={isTransit ? 5.5 : 7}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.8}
            />
            <path
              d={geographicPath(p.shape as [number, number][])}
              fill="none"
              stroke={p.color}
              strokeWidth={isTransit ? 3.5 : 4.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={isTransit ? 0.35 : 0.85}
            />
          </g>
        ))}
        {/* Active MBTA Transit Route in Foreground */}
        {activePatterns.map((p) => (
          <g key={p.pattern} className="transit-line-active">
            <path
              d={geographicPath(p.shape as [number, number][])}
              fill="none"
              stroke="var(--card)"
              strokeWidth={11}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={geographicPath(p.shape as [number, number][])}
              fill="none"
              stroke={p.color}
              strokeWidth={7.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={1}
            />
          </g>
        ))}
        {/* Active Route Station Stops */}
        {isTransit &&
          [...new Set(activePatterns.flatMap((p) => p.stops))].map((id) => {
            const s = stops[id]
            if (!s) return null
            const [a, b] = project(s.lat, s.lng)
            return (
              <circle
                key={id}
                cx={a}
                cy={b}
                r="5"
                fill="#ffffff"
                stroke={activePatterns[0]?.color ?? '#00843D'}
                strokeWidth="2.5"
              >
                <title>{s.name}</title>
              </circle>
            )
          })}
        {/* Walking Radius & Origin */}
        {f.scope === 'radius' && (
          <>
            <circle
              cx={x}
              cy={y}
              r={kmToPx(f.radius * 1.609344)}
              fill="#15803d12"
              stroke="#15803d"
              strokeWidth="2"
              strokeDasharray="8 6"
            />
            <circle cx={x} cy={y} r="8" fill="#1d4ed8" stroke="#ffffff" strokeWidth="3" />
          </>
        )}
        {/* Neighborhood Pantry Pins */}
        {sites.map((s) => {
          const [a, b] = project(s.lat, s.lng)
          return (
            <g
              key={s.id}
              data-site={s.id}
              role="button"
              tabIndex={0}
              aria-label={'Explore ' + s.name}
              onClick={() => onSite(s.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSite(s.id)
                }
              }}
              transform={`translate(${a},${b})`}
              className="pantry-pin-marker"
            >
              <title>{s.name} · Fictional pantry</title>
              <path
                className="pantry-pin"
                d="M0 0Q-15 -15 -15 -24a15 15 0 1 1 30 0Q15 -15 0 0"
                fill="#ba3828"
                stroke="#ffffff"
                strokeWidth="3.2"
              />
              <circle cy="-24" r="5" fill="#ffffff" />
              <circle cy="-24" r="2.2" fill="#ba3828" />
              <text y="14" textAnchor="middle" className="pantry-pin-label">
                {s.neighborhood}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="route-map-caption">
        <div className="map-legend">
          <span className="legend-item">
            <span className="legend-dot pin" aria-hidden="true" /> Pantry location
          </span>
          <span className="legend-item">
            <span className="legend-line transit" aria-hidden="true" /> MBTA transit network
          </span>
          {f.scope === 'radius' && (
            <span className="legend-item">
              <span className="legend-dot radius" aria-hidden="true" /> Origin & {f.radius} mi radius
            </span>
          )}
        </div>
        <div className="map-attribution">
          {f.scope === 'transit' ? routeName(f.route) : 'Fictional pantry sites'} ·{' '}
          <a href={transitSource}>MBTA GTFS</a> · {transitDate}.
          {f.scope === 'radius' && ' Tap the map to set your origin.'}
        </div>
      </figcaption>
    </figure>
  )
}
