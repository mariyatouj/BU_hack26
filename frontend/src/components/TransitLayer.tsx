import { geographicPath, project } from '../geo'

export interface TransitRoute {
  id: string
  color: string
  shape: readonly (readonly [lat: number, lng: number])[]
  stops: readonly { id: string; name: string; lat: number; lng: number }[]
}

export default function TransitLayer({ routes }: { routes: readonly TransitRoute[] }) {
  return (
    <g>
      {routes.map(({ id, color, shape, stops }) => (
        <g key={id}>
          <path d={geographicPath(shape)} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
          {stops.map(({ id, name, lat, lng }) => {
            const [x, y] = project(lat, lng)
            return (
              <circle key={id} cx={x} cy={y} r="4.5" fill="var(--map-land)" stroke={color} strokeWidth="2.5">
                <title>{name}</title>
              </circle>
            )
          })}
        </g>
      ))}
    </g>
  )
}
