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

export default function RouteMap({
  f,
  sites,
  onSite,
  onOrigin,
}: {
  f: Search
  sites: Site[]
  onSite: (id: string) => void
  onOrigin: (pos: [number, number]) => void
}) {
  const active = patterns.filter((p) => p.id === f.route && (!f.direction || p.headsign === f.direction))
  const lines = f.scope === 'transit' ? active : patterns.filter((p) => p.direction === 0)
  const [x, y] = project(...f.origin)
  return (
    <figure className="route-map">
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
        <path d={RIVER} fill="none" stroke="var(--map-water)" strokeWidth="22" />
        {NEIGHBORHOODS.map(([name, lat, lng]) => {
          const [a, b] = project(lat, lng)
          return (
            <text x={a} y={b} key={name} textAnchor="middle" className="map-hood">
              {name}
            </text>
          )
        })}
        {lines.map((p) => (
          <path
            key={p.pattern}
            d={geographicPath(p.shape as [number, number][])}
            fill="none"
            stroke={p.color}
            strokeWidth={f.scope === 'transit' ? 6 : 3}
            opacity={f.scope === 'transit' ? 1 : 0.5}
          />
        ))}
        {f.scope === 'transit' &&
          [...new Set(active.flatMap((p) => p.stops))].map((id) => {
            const s = stops[id]
            const [a, b] = project(s.lat, s.lng)
            return (
              <circle key={id} cx={a} cy={b} r="4" fill="white" stroke="#243729">
                <title>{s.name}</title>
              </circle>
            )
          })}
        {f.scope === 'radius' && (
          <>
            <circle
              cx={x}
              cy={y}
              r={kmToPx(f.radius * 1.609344)}
              fill="#37895c12"
              stroke="#43865e"
              strokeDasharray="9 6"
            />
            <circle cx={x} cy={y} r="7" fill="#2568a1" stroke="white" strokeWidth="3" />
          </>
        )}
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
            >
              <title>{s.name} · Fictional pantry</title>
              <path
                className="pantry-pin"
                d="M0 0Q-16 -16 -16 -26a16 16 0 1 1 32 0Q16 -16 0 0"
                fill="#b34237"
                stroke="white"
                strokeWidth="3"
              />
              <circle cy="-26" r="5" fill="white" />
            </g>
          )
        })}
      </svg>
      <figcaption>
        {f.scope === 'transit' ? routeName(f.route) : 'Fictional pantry sites'} ·{' '}
        <a href={transitSource}>MBTA GTFS</a> · {transitDate}.
        {f.scope === 'radius' && ' Tap the map to set your origin.'}
      </figcaption>
    </figure>
  )
}
