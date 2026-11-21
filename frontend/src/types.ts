export type Level = 'out' | 'low' | 'medium' | 'high'
export type DistModel = 'client-choice' | 'pre-packed' | 'mobile' | 'drive-thru'

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
}

export interface PantryDetail extends Pantry {
  items: Item[]
  reviews: { stars: number; comment: string | null; created_at: string }[]
  recipes: Recipe[]
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
