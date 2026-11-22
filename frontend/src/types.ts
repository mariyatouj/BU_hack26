export interface TransitStop {
  id: string
  name: string
  address: string | null
  municipality: string | null
  latitude: number
  longitude: number
  wheelchair_boarding: number | null
  distance_m: number
}

export interface TransitPrediction {
  id: string
  stop_id: string
  trip_id: string | null
  route: {
    id: string
    name: string
    short_name: string
    color: string
    text_color: string
    type: number
  }
  direction_id: number | null
  arrival_time: string | null
  departure_time: string | null
  minutes: number | null
  status: string
}

export interface TransitAlert {
  id: string
  header: string
  effect: string | null
  severity: number | null
  timeframe: string | null
}

export interface Directions {
  pantry: { id: number; name: string; address: string; lat: number; lng: number }
  source: 'mbta-v3' | 'fallback'
  live: boolean
  routing_mode: 'nearby-stops' | 'external'
  generated_at: string
  origin_stored: false
  directions_url: string
  origin_stops: TransitStop[]
  destination_stops: TransitStop[]
  predictions: TransitPrediction[]
  alerts: TransitAlert[]
  warnings: string[]
}
