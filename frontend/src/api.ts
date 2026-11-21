import type {
  AlertIn, Directions, Earned, FoodAlert, Leaderboard, Me, Notice, Pantry, PantryDetail, Recipe, RecipeIn, Rules,
  Suggestion, User,
} from './types'
import { mock } from './demo/mock'
import { getUserId } from './session'

export interface Api {
  users(): Promise<User[]>
  me(): Promise<Me>
  rules(): Promise<Rules>
  pantries(): Promise<Pantry[]>
  pantry(id: number): Promise<PantryDetail>
  directions(pantry_id: number, origin_lat: number, origin_lng: number): Promise<Directions>
  visit(id: number): Promise<Earned>
  ratePantry(id: number, stars: number, comment: string): Promise<Earned>
  updateInventory(id: number, items: { name: string; category: string; level: string }[]): Promise<Earned>
  submitPantry(p: { name: string; address: string; neighborhood: string; lat: number; lng: number; distribution_model: string; features: string[]; hours: Record<string, string> }): Promise<{ id: number; message: string }>
  recipes(f: { culture?: string; dietary?: string; q?: string; sort?: string; pantry_id?: number }): Promise<Recipe[]>
  createRecipe(r: RecipeIn): Promise<Earned & { recipe: Recipe }>
  rateRecipe(id: number, taste: number, ease: number): Promise<Earned & { recipe: Recipe }>
  leaderboard(period: string, group: string): Promise<Leaderboard>
  alerts(): Promise<FoodAlert[]>
  createAlert(a: AlertIn): Promise<FoodAlert>
  deleteAlert(id: number): Promise<unknown>
  dishes(): Promise<Record<string, string[]>>
  notifications(): Promise<Notice[]>
  markRead(): Promise<unknown>
  suggest(pantry_id: number, dietary: string[], culture: string | null): Promise<Suggestion>
}

const BASE = import.meta.env.VITE_API_URL ?? ''

async function req<T>(path: string, init?: RequestInit, includeIdentity = true): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(includeIdentity ? { 'X-User-Id': String(getUserId()) } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(typeof body.detail === 'string' ? body.detail : `Request failed (${res.status})`)
  }
  return res.json()
}

const qs = (o: Record<string, unknown>) =>
  '?' + new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => [k, String(v)]))
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })

const http: Api = {
  users: () => req('/api/users'),
  me: () => req('/api/me'),
  rules: () => req('/api/points/rules'),
  // Distance is calculated in the browser; precise visitor coordinates do not enter access-log URLs.
  pantries: () => req('/api/pantries'),
  pantry: (id) => req(`/api/pantries/${id}`),
  // Intentionally anonymous. The backend uses this origin for one request and never stores it.
  directions: (pantry_id, origin_lat, origin_lng) => req('/api/directions', {
    ...post({ pantry_id, origin_lat, origin_lng }),
    cache: 'no-store',
    credentials: 'omit',
    headers: { 'Cache-Control': 'no-store' },
  }, false),
  visit: (id) => req(`/api/pantries/${id}/visit`, { method: 'POST' }),
  ratePantry: (id, stars, comment) => req(`/api/pantries/${id}/rate`, post({ stars, comment })),
  updateInventory: (id, items) => req(`/api/pantries/${id}/inventory`, post({ items })),
  submitPantry: (p) => req('/api/pantries', post(p)),
  recipes: (f) => req('/api/recipes' + qs(f)),
  createRecipe: (r) => req('/api/recipes', post(r)),
  rateRecipe: (id, taste, ease) => req(`/api/recipes/${id}/rate`, post({ taste, ease })),
  leaderboard: (period, group) => req('/api/leaderboard' + qs({ period, group })),
  alerts: () => req('/api/alerts'),
  createAlert: (a) => req('/api/alerts', post(a)),
  deleteAlert: (id) => req(`/api/alerts/${id}`, { method: 'DELETE' }),
  dishes: () => req('/api/dishes'),
  notifications: () => req('/api/notifications'),
  markRead: () => req('/api/notifications/read', { method: 'POST' }),
  suggest: (pantry_id, dietary, culture) => req('/api/ai/suggest', post({ pantry_id, dietary, culture })),
}

/** Use the FastAPI backend when it answers; otherwise run on in-browser demo data. */
export async function connect(): Promise<{ api: Api; mode: 'live' | 'demo'; gemini: boolean }> {
  if (import.meta.env.VITE_DEMO === '1') return { api: mock, mode: 'demo', gemini: false }
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2500)
    const res = await fetch(BASE + '/api/health', { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) throw new Error()
    const h = await res.json()
    return { api: http, mode: 'live', gemini: !!h.gemini }
  } catch {
    return { api: mock, mode: 'demo', gemini: false }
  }
}
