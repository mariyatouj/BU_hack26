export type Level = 'out' | 'low' | 'medium' | 'high'
export type DistModel = 'client-choice' | 'pre-packed' | 'mobile' | 'drive-thru' | 'unknown'

export interface User {
  id: number
  name: string
  university: string | null
  t_line: string | null
  avatar: string
  points: number
  level: string
}

export interface Me extends User {
  history: { action: string; points: number; created_at: string }[]
}

export interface Item {
  name: string
  category: string
  level: Level
  source: 'demo' | 'community' | 'pantry' | 'partner'
  updated_at: string
}

export interface Pantry {
  id: number
  name: string
  address: string
  neighborhood: string
  lat: number
  lng: number
  distribution_model: DistModel
  hours: Record<string, string>
  features: string[]
  inventory_level: 'low' | 'medium' | 'high'
  verified: boolean
  rating: number | null
  rating_count: number
  item_count: number
  last_updated: string | null
  cooks_last_30d: number
  visits_last_30d: number
  distance_km: number | null
  phone?: string | null
  source_name?: string | null
  source_url?: string | null
  inventory_status?: 'demo' | 'mixed' | 'reported' | 'unknown'
}

export interface PantryDetail extends Pantry {
  items: Item[]
  reviews: { stars: number; comment: string | null; created_at: string }[]
  recipes: Recipe[]
}

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

export interface Recipe {
  id: number
  title: string
  description: string
  ingredients: string[]
  steps: string[]
  culture_tags: string[]
  dietary_tags: string[]
  image_url: string | null
  minutes: number
  created_at: string
  author: { id: number; name: string; university: string | null }
  pantry: { id: number; name: string } | null
  taste: number | null
  ease: number | null
  rating_count: number
  score: number
}

export interface RecipeIn {
  title: string
  description: string
  ingredients: string[]
  steps: string[]
  culture_tags: string[]
  dietary_tags: string[]
  pantry_id: number | null
  image_url: string | null
  minutes: number
}

export interface LeaderRow {
  rank: number
  key: string
  points: number
  members?: number
  user?: User
  prize: string | null
}

export interface Leaderboard {
  period: 'week' | 'month' | 'all'
  group: 'user' | 'university' | 't_line'
  rows: LeaderRow[]
  top_recipes: Recipe[]
}

export interface AlertMatch {
  pantry_id: number
  pantry_name: string
  distance_km: number
  match: number
  have: string[]
  missing: string[]
}

export interface FoodAlert {
  id: number
  dish: string
  culture: string | null
  ingredients: string[]
  lat: number
  lng: number
  radius_km: number
  notify_on: ('ingredients' | 'recipe')[]
  min_match: number
  active: boolean
  created_at: string
  matches: AlertMatch[]
}

export interface AlertIn {
  dish: string
  culture: string | null
  ingredients: string[] | null
  lat: number
  lng: number
  radius_km: number
  notify_on: ('ingredients' | 'recipe')[]
  min_match: number
}

export interface Notice {
  id: number
  kind: 'ingredients' | 'recipe'
  message: string
  pantry_id: number | null
  recipe_id: number | null
  read: boolean
  created_at: string
}

export interface Meal {
  title: string
  culture: string
  minutes: number
  uses: string[]
  missing: string[]
  substitutions: string[]
  how: string
}

export interface Suggestion {
  source: 'gemini' | 'fallback'
  pantry: string
  meals: Meal[]
  error?: string
}

export interface Rules {
  points: Record<string, number>
  prizes: { rank: number; prize: string }[]
}

export interface Earned {
  points_earned: number
  total?: number
  alerts_triggered?: number
  message?: string
}
