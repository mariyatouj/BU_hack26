import { useRef } from 'react'
import { EASTIE, H, HARBOR, NEIGHBORHOODS, RIVER, T_LINES, W, kmToPx, linePath, project, unproject } from '../geo'
import type { Pantry } from '../types'

interface Props {
  pantries: Pantry[]
  selectedId?: number | null
  onSelect?: (id: number) => void
  you: [number, number]
  onMoveYou?: (lat: number, lng: number) => void
  radiusKm?: number
  dimIds?: Set<number>
}

const LEVEL_COLOR: Record<string, string> = { high: 'var(--good)', medium: 'var(--mid)', low: 'var(--bad)' }

export default function BostonMap({ pantries, selectedId, onSelect, you, onMoveYou, radiusKm, dimIds }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const [yx, yy] = project(you[0], you[1])

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onMoveYou || !svg.current) return
    if ((e.target as Element).closest('[data-pin]')) return
    const pt = svg.current.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.current.getScreenCTM()!.inverse())
    const [lat, lng] = unproject(p.x, p.y)
    onMoveYou(lat, lng)
  }

  return (
    <svg ref={svg} className="map" viewBox={`0 0 ${W} ${H}`} onClick={handleClick} role="img"
      aria-label="Map of Boston food pantries" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="var(--map-grid)" strokeWidth="1" />
        </pattern>
        <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity=".28" />
        </filter>
      </defs>
      <rect width={W} height={H} fill="var(--map-land)" />
      <rect width={W} height={H} fill="url(#grid)" />
      <path d={HARBOR} fill="var(--map-water)" />
      <path d={EASTIE} fill="var(--map-land)" />
      <path d={RIVER} fill="none" stroke="var(--map-water)" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
      {NEIGHBORHOODS.map(([name, lat, lng]) => {
        const [x, y] = project(lat, lng)
        return <text key={name} x={x} y={y} className="map-hood" textAnchor="middle">{name}</text>
      })}
      {T_LINES.map((l) => (
        <g key={l.name}>
          <path d={linePath(l.stops)} fill="none" stroke={l.color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
          {l.stops.map(([s, lat, lng]) => {
            const [x, y] = project(lat, lng)
            return <circle key={s} cx={x} cy={y} r="4.5" fill="var(--map-land)" stroke={l.color} strokeWidth="2.5"><title>{s}</title></circle>
          })}
        </g>
      ))}
      {radiusKm ? <circle cx={yx} cy={yy} r={kmToPx(radiusKm)} className="map-radius" /> : null}
      {pantries.map((p) => {
        const [x, y] = project(p.lat, p.lng)
        const sel = p.id === selectedId
        const dim = dimIds?.has(p.id)
        return (
          <g key={p.id} data-pin transform={`translate(${x},${y})`} className={`pin${sel ? ' sel' : ''}`} opacity={dim ? 0.35 : 1}
            onClick={() => onSelect?.(p.id)} role="button" tabIndex={0} aria-label={p.name}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect?.(p.id) }}>
            <g filter="url(#pinShadow)">
              <path d="M0 0 C-4 -9 -15 -15 -15 -27 A15 15 0 1 1 15 -27 C15 -15 4 -9 0 0Z" fill="var(--pin)" />
              <circle cy="-27" r="8.5" fill={LEVEL_COLOR[p.inventory_level]} />
            </g>
            {sel && (
              <g transform="translate(0,-54)">
                <rect x={-p.name.length * 4.6 - 12} y="-22" width={p.name.length * 9.2 + 24} height="30" rx="15" fill="var(--ink)" />
                <text y="-2" textAnchor="middle" className="pin-label">{p.name}</text>
              </g>
            )}
          </g>
        )
      })}
      <g transform={`translate(${yx},${yy})`} className="you" pointerEvents="none">
        <circle r="18" className="you-halo" />
        <circle r="8" fill="var(--accent)" stroke="#fff" strokeWidth="3" />
      </g>
    </svg>
  )
}
