/**
 * In-browser stand-in for the FastAPI backend, built from the same data/seed.json.
 * Mirrors the backend rules (points, alerts, leaderboard, fallback meal ideas) so the
 * UI can be demoed with no server. State resets on reload.
 */
import seed from '../../../data/seed.json'
import inventoryCsv from '../../../data/demo_inventory.csv?raw'
import type { Api } from '../api'
import { getUserId } from '../session'
import type { AlertIn, FoodAlert, Item, Level, Meal, Notice, Pantry, PantryDetail, Recipe, User } from '../types'

const POINTS: Record<string, number> = {
  share_recipe: 20, recipe_photo: 10, rate_recipe: 5, rate_pantry: 5,
  visit_pantry: 10, submit_pantry: 30, update_inventory: 5,
}
const PRIZES = [
  { rank: 1, prize: 'Customized CharlieCard + 7-day T-pass' },
  { rank: 2, prize: '7-day T-pass' },
  { rank: 3, prize: 'Gold Ladle badge' },
  { rank: 10, prize: 'Top-10 avatar frame' },
]
const LEVELS: [number, string][] = [[0, 'Seedling'], [100, 'Sprout'], [250, 'Harvester'], [500, 'Pantry Pro'], [1000, 'Boston Legend']]
const DISHES: Record<string, string[]> = {
  'fried rice': ['rice', 'eggs', 'frozen peas', 'carrots', 'onion', 'soy sauce'],
  'rice and beans': ['rice', 'black beans', 'onion', 'garlic', 'canned tomatoes'],
  dal: ['lentils', 'onion', 'garlic', 'canned tomatoes', 'rice'],
  pasta: ['pasta', 'canned tomatoes', 'garlic', 'onion'],
  chili: ['black beans', 'canned tomatoes', 'onion', 'ground turkey', 'rice'],
  congee: ['rice', 'ginger', 'chicken', 'scallions'],
  shakshuka: ['eggs', 'canned tomatoes', 'onion', 'bell peppers'],
  oatmeal: ['oats', 'milk', 'bananas', 'peanut butter'],
  'stir fry': ['rice', 'tofu', 'broccoli', 'carrots', 'soy sauce'],
  soup: ['potatoes', 'carrots', 'onion', 'lentils'],
}
const TEMPLATES: [string, string, string[], string[], number, string][] = [
  ['Egg fried rice', 'Chinese', ['rice', 'eggs', 'frozen peas', 'carrots', 'onion'], ['Vegetarian'], 20, 'Day-old rice works best. Scramble eggs first, then toss everything in a very hot pan.'],
  ['Arroz con frijoles', 'Latin American', ['rice', 'black beans', 'onion', 'garlic'], ['Vegan', 'Halal'], 35, 'Sofrito the onion and garlic, add beans with their liquid, serve over rice.'],
  ['Masoor dal', 'South Asian', ['lentils', 'onion', 'garlic', 'canned tomatoes'], ['Vegan', 'Halal'], 30, 'Simmer lentils until soft, finish with onion-garlic tadka. Great with rice.'],
  ['Shakshuka', 'Middle Eastern', ['eggs', 'canned tomatoes', 'onion', 'bell peppers'], ['Vegetarian'], 25, 'Cook down tomatoes and peppers, crack eggs into wells, cover until set.'],
  ['Peanut butter banana oats', 'American', ['oats', 'milk', 'bananas', 'peanut butter'], ['Vegetarian'], 10, 'Cook oats in milk, top with sliced banana and a spoon of peanut butter.'],
  ['Tomato garlic pasta', 'Italian', ['pasta', 'canned tomatoes', 'garlic', 'onion'], ['Vegan'], 20, 'Simmer tomatoes with garlic while pasta cooks; loosen with pasta water.'],
  ['Potato lentil soup', 'Irish', ['potatoes', 'carrots', 'onion', 'lentils'], ['Vegan', 'Halal'], 40, 'One pot: sweat onion and carrot, add diced potato and lentils, cover with water and simmer.'],
  ['Tofu broccoli stir fry', 'Chinese', ['tofu', 'broccoli', 'carrots', 'rice', 'soy sauce'], ['Vegan'], 25, 'Crisp the tofu first, then stir-fry vegetables and glaze with soy sauce.'],
  ['Turkey bean chili', 'American', ['ground turkey', 'black beans', 'canned tomatoes', 'onion'], ['Halal'], 45, 'Brown turkey with onion, add beans and tomatoes, simmer 30 minutes.'],
  ['Chicken ginger congee', 'Chinese', ['rice', 'chicken', 'ginger', 'scallions'], [], 60, 'Simmer rice in lots of water with ginger and chicken until creamy; top with scallions.'],
]

const H = 3600e3, D = 24 * H
const now = () => Date.now()
const iso = (t: number) => new Date(t).toISOString()
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length
const n = (s: string) => s.trim().toLowerCase()
const level = (p: number) => LEVELS.filter(([t]) => p >= t).pop()![1]

type DUser = Omit<User, 'level'>
interface DPantry extends Omit<Pantry, 'rating' | 'rating_count' | 'item_count' | 'last_updated' | 'cooks_last_30d' | 'visits_last_30d' | 'distance_km'> {
  submitted_by?: number
}
interface DItem { pantry_id: number; name: string; category: string; level: Level; source: Item['source']; t: number }
interface DRecipe { id: number; user_id: number; pantry_id: number | null; title: string; description: string; ingredients: string[]; steps: string[]; culture_tags: string[]; dietary_tags: string[]; image_url: string | null; minutes: number; t: number }
interface DAlert extends Omit<FoodAlert, 'matches' | 'created_at'> { user_id: number; t: number }

const db = {
  users: [] as DUser[],
  pantries: [] as DPantry[],
  items: [] as DItem[],
  pratings: [] as { pantry_id: number; user_id: number; stars: number; comment: string | null; t: number }[],
  recipes: [] as DRecipe[],
  rratings: [] as { recipe_id: number; user_id: number; taste: number; ease: number; t: number }[],
  events: [] as { user_id: number; action: string; points: number; ref: number | null; t: number }[],
  alerts: [] as DAlert[],
  notes: [] as (Notice & { user_id: number; alert_id: number | null; t: number })[],
  seq: 100,
}

function award(uid: number, action: string, ref: number | null = null, t = now()) {
  const pts = POINTS[action]
  db.events.push({ user_id: uid, action, points: pts, ref, t })
  const u = db.users.find((x) => x.id === uid)!
  u.points += pts
  return pts
}

;(function load() {
  const t0 = now()
  db.users = seed.users.map((u) => ({ ...u, points: 0 }))
  for (const p of seed.pantries) {
    db.pantries.push({ ...(p as unknown as DPantry), verified: true })
  }
  for (const line of inventoryCsv.trim().split(/\r?\n/).slice(1)) {
    const [pantryId, name, category, itemLevel, hoursAgo] = line.split(',')
    db.items.push({
      pantry_id: Number(pantryId),
      name,
      category,
      level: itemLevel as Level,
      source: 'demo',
      t: t0 - Number(hoursAgo) * H,
    })
  }
  for (const r of seed.recipes) {
    const { ratings, days_ago, ...rest } = r
    db.recipes.push({ ...rest, image_url: null, t: t0 - days_ago * D })
    award(r.user_id, 'share_recipe', r.id, t0 - days_ago * D - r.user_id * H)
    for (const [uid, taste, ease] of ratings) {
      const t = t0 - Math.max(days_ago - 1, 0) * D - uid * H
      db.rratings.push({ recipe_id: r.id, user_id: uid, taste, ease, t })
      award(uid, 'rate_recipe', r.id, t)
    }
  }
  for (const [pid, uid, stars] of seed.pantry_ratings) {
    db.pratings.push({ pantry_id: pid, user_id: uid, stars, comment: null, t: t0 })
    award(uid, 'rate_pantry', pid, t0 - ((pid * uid) % 20) * D - uid * H)
  }
  for (const [pid, uid, days] of seed.visits) award(uid, 'visit_pantry', pid, t0 - days * D - uid * H)
  seed.alerts.forEach((a, i) => db.alerts.push({
    id: i + 1, ...a, culture: a.culture, ingredients: DISHES[a.dish] ?? [], notify_on: ['ingredients', 'recipe'],
    min_match: 0.6, active: true, t: t0,
  }))
})()

// ---------- helpers mirroring backend/app ----------

function km(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (d: number) => (d * Math.PI) / 180
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}
const me = () => db.users.find((u) => u.id === getUserId())!
const userOut = (u: DUser): User => ({ ...u, level: level(u.points) })

function latest(pid: number) {
  const seen = new Set<string>()
  return db.items.filter((i) => i.pantry_id === pid).sort((a, b) => b.t - a.t).filter((i) => {
    if (seen.has(n(i.name))) return false
    seen.add(n(i.name))
    return true
  })
}
const fresh = (pid: number) => new Set(latest(pid).filter((i) => i.level !== 'out' && i.t >= now() - 7 * D).map((i) => n(i.name)))

function score(wanted: string[], stock: Set<string>) {
  const w = wanted.map(n)
  const have = w.filter((x) => [...stock].some((s) => s.includes(x) || x.includes(s)))
  return { match: w.length ? have.length / w.length : 0, have, missing: w.filter((x) => !have.includes(x)) }
}

function pantryOut(p: DPantry, lat?: number, lng?: number): Pantry {
  const stars = db.pratings.filter((r) => r.pantry_id === p.id).map((r) => r.stars)
  const items = latest(p.id)
  const sources = new Set(items.map((i) => i.source))
  const month = now() - 30 * D
  return {
    ...p,
    rating: stars.length ? Math.round(mean(stars) * 10) / 10 : null,
    rating_count: stars.length,
    item_count: items.filter((i) => i.level !== 'out').length,
    last_updated: items.length ? iso(Math.max(...items.map((i) => i.t))) : null,
    cooks_last_30d: new Set(db.recipes.filter((r) => r.pantry_id === p.id && r.t >= month).map((r) => r.user_id)).size,
    visits_last_30d: db.events.filter((e) => e.action === 'visit_pantry' && e.ref === p.id && e.t >= month).length,
    distance_km: lat != null && lng != null ? Math.round(km(lat, lng, p.lat, p.lng) * 100) / 100 : null,
    inventory_status: !items.length ? 'unknown'
      : sources.size === 1 && sources.has('demo') ? 'demo'
        : sources.has('demo') ? 'mixed'
          : 'reported',
  }
}

function recipeOut(r: DRecipe): Recipe {
  const rs = db.rratings.filter((x) => x.recipe_id === r.id)
  const u = db.users.find((x) => x.id === r.user_id)!
  const p = db.pantries.find((x) => x.id === r.pantry_id)
  const taste = rs.length ? mean(rs.map((x) => x.taste)) : null
  const ease = rs.length ? mean(rs.map((x) => x.ease)) : null
  return {
    id: r.id, title: r.title, description: r.description, ingredients: r.ingredients, steps: r.steps,
    culture_tags: r.culture_tags, dietary_tags: r.dietary_tags, image_url: r.image_url, minutes: r.minutes,
    created_at: iso(r.t), author: { id: u.id, name: u.name, university: u.university },
    pantry: p ? { id: p.id, name: p.name } : null,
    taste: taste && Math.round(taste * 10) / 10, ease: ease && Math.round(ease * 10) / 10,
    rating_count: rs.length, score: taste && ease ? Math.round(((taste + ease) / 2) * 100) / 100 : 0,
  }
}

function matches(a: DAlert) {
  return db.pantries.filter((p) => p.verified).map((p) => ({ p, d: km(a.lat, a.lng, p.lat, p.lng) }))
    .filter(({ d }) => d <= a.radius_km)
    .map(({ p, d }) => ({ pantry_id: p.id, pantry_name: p.name, distance_km: Math.round(d * 100) / 100, ...score(a.ingredients, fresh(p.id)) }))
    .map((m) => ({ ...m, match: Math.round(m.match * 100) / 100 }))
    .sort((x, y) => y.match - x.match || x.distance_km - y.distance_km)
}
const alertOut = (a: DAlert): FoodAlert => ({ ...a, created_at: iso(a.t), matches: matches(a) })

function notify(a: DAlert, kind: Notice['kind'], message: string, pantry_id: number | null, recipe_id: number | null) {
  db.notes.push({ id: ++db.seq, user_id: a.user_id, alert_id: a.id, kind, message, pantry_id, recipe_id, read: false, created_at: iso(now()), t: now() })
}

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120))
const fail = (m: string) => Promise.reject(new Error(m))

// ---------- Api implementation ----------

export const mock: Api = {
  users: () => delay(db.users.map(userOut)),
  me: () => delay({
    ...userOut(me()),
    history: db.events.filter((e) => e.user_id === me().id).sort((a, b) => b.t - a.t).slice(0, 15)
      .map((e) => ({ action: e.action, points: e.points, created_at: iso(e.t) })),
  }),
  rules: () => delay({ points: POINTS, prizes: PRIZES }),

  pantries: () => delay(db.pantries.filter((p) => p.verified).map((p) => pantryOut(p))),
  pantry: (id) => {
    const p = db.pantries.find((x) => x.id === id)
    if (!p) return fail('Pantry not found')
    const detail: PantryDetail = {
      ...pantryOut(p),
      items: latest(id).map((i): Item => ({ name: i.name, category: i.category, level: i.level, source: i.source, updated_at: iso(i.t) }))
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
      reviews: db.pratings.filter((r) => r.pantry_id === id).map((r) => ({ stars: r.stars, comment: r.comment, created_at: iso(r.t) })),
      recipes: db.recipes.filter((r) => r.pantry_id === id).sort((a, b) => b.t - a.t).map(recipeOut),
    }
    return delay(detail)
  },
  directions: (pantry_id, _origin_lat, _origin_lng) => {
    const p = db.pantries.find((x) => x.id === pantry_id)
    if (!p) return fail('Pantry not found')
    const destination = encodeURIComponent(`${p.lat},${p.lng}`)
    return delay({
      pantry: { id: p.id, name: p.name, address: p.address, lat: p.lat, lng: p.lng },
      source: 'fallback' as const,
      live: false,
      routing_mode: 'external' as const,
      generated_at: iso(now()),
      origin_stored: false as const,
      // Origin is deliberately omitted so Pantry Pass never writes it into browser history.
      directions_url: `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=transit`,
      origin_stops: [],
      destination_stops: [],
      predictions: [],
      alerts: [],
      warnings: ['Demo mode: open the transit planner for live routing.'],
    })
  },
  visit: (id) => {
    const dup = db.events.some((e) => e.user_id === me().id && e.action === 'visit_pantry' && e.ref === id && e.t >= now() - 12 * H)
    if (dup) return delay({ points_earned: 0, total: me().points, message: 'Already checked in today' })
    return delay({ points_earned: award(me().id, 'visit_pantry', id), total: me().points })
  },
  ratePantry: (id, stars, comment) => {
    db.pratings.push({ pantry_id: id, user_id: me().id, stars, comment: comment || null, t: now() })
    return delay({ points_earned: award(me().id, 'rate_pantry', id), total: me().points })
  },
  updateInventory: (id, items) => {
    const p = db.pantries.find((x) => x.id === id)!
    items.forEach((i) => db.items.push({ pantry_id: id, name: i.name, category: i.category, level: i.level as Level, source: 'community', t: now() }))
    const pts = award(me().id, 'update_inventory', id)
    let hits = 0
    const stock = fresh(id)
    for (const a of db.alerts.filter((a) => a.active && a.notify_on.includes('ingredients'))) {
      const d = km(a.lat, a.lng, p.lat, p.lng)
      if (d > a.radius_km) continue
      const s = score(a.ingredients, stock)
      const recent = db.notes.some((x) => x.alert_id === a.id && x.pantry_id === id && x.kind === 'ingredients' && x.t >= now() - D)
      if (s.match < a.min_match || recent) continue
      notify(a, 'ingredients', `${p.name} (${d.toFixed(1)} km away) now has ${s.have.length}/${a.ingredients.length} ingredients for ${a.dish}.` +
        (s.missing.length ? ` Still missing: ${s.missing.join(', ')}.` : ''), id, null)
      hits++
    }
    return delay({ points_earned: pts, total: me().points, alerts_triggered: hits })
  },
  submitPantry: (p) => {
    const id = ++db.seq
    db.pantries.push({ ...p, id, verified: false, inventory_level: 'medium', submitted_by: me().id } as DPantry)
    return delay({ id, message: `Thanks! You'll earn ${POINTS.submit_pantry} points once it's verified.` })
  },

  recipes: (f) => {
    let out = db.recipes.map(recipeOut)
    if (f.culture) out = out.filter((r) => r.culture_tags.includes(f.culture!))
    if (f.dietary) out = out.filter((r) => r.dietary_tags.includes(f.dietary!))
    if (f.pantry_id) out = out.filter((r) => r.pantry?.id === f.pantry_id)
    if (f.q) {
      const q = n(f.q)
      out = out.filter((r) => n(r.title).includes(q) || r.ingredients.some((i) => n(i).includes(q)))
    }
    const sort = f.sort ?? 'top'
    out.sort(sort === 'new' ? (a, b) => b.created_at.localeCompare(a.created_at)
      : sort === 'easy' ? (a, b) => (b.ease ?? 0) - (a.ease ?? 0) || a.minutes - b.minutes
        : (a, b) => b.score - a.score || b.rating_count - a.rating_count)
    return delay(out)
  },
  createRecipe: (body) => {
    const r: DRecipe = { ...body, id: ++db.seq, user_id: me().id, t: now() }
    db.recipes.push(r)
    let pts = award(me().id, 'share_recipe', r.id)
    if (body.image_url) pts += award(me().id, 'recipe_photo', r.id)
    const p = db.pantries.find((x) => x.id === r.pantry_id)
    let hits = 0
    for (const a of db.alerts.filter((a) => a.active && a.notify_on.includes('recipe') && a.user_id !== r.user_id)) {
      const t = n(r.title)
      const dishHit = t.includes(n(a.dish)) || n(a.dish).split(' ').some((w) => w.length > 3 && t.includes(w))
      const cultHit = !!a.culture && r.culture_tags.map(n).includes(n(a.culture))
      if (!(dishHit || cultHit)) continue
      if (p && km(a.lat, a.lng, p.lat, p.lng) > a.radius_km) continue
      notify(a, 'recipe', `New recipe matching your '${a.dish}' alert: ${r.title}${p ? ` using food from ${p.name}` : ''}.`, r.pantry_id, r.id)
      hits++
    }
    return delay({ recipe: recipeOut(r), points_earned: pts, total: me().points, alerts_triggered: hits })
  },
  rateRecipe: (id, taste, ease) => {
    const r = db.recipes.find((x) => x.id === id)!
    if (r.user_id === me().id) return fail("You can't rate your own recipe")
    const ex = db.rratings.find((x) => x.recipe_id === id && x.user_id === me().id)
    let pts = 0
    if (ex) Object.assign(ex, { taste, ease })
    else {
      db.rratings.push({ recipe_id: id, user_id: me().id, taste, ease, t: now() })
      pts = award(me().id, 'rate_recipe', id)
    }
    return delay({ recipe: recipeOut(r), points_earned: pts, total: me().points })
  },

  leaderboard: (period, group) => {
    const since = period === 'week' ? now() - 7 * D : period === 'month' ? now() - 30 * D : 0
    const totals = new Map<number, number>()
    db.events.filter((e) => e.t >= since).forEach((e) => totals.set(e.user_id, (totals.get(e.user_id) ?? 0) + e.points))
    const users = new Map(db.users.map((u) => [u.id, u]))
    let rows: { key: string; points: number; members?: number; user?: User }[]
    if (group === 'user') rows = [...totals].map(([uid, pts]) => ({ key: users.get(uid)!.name, user: userOut(users.get(uid)!), points: pts }))
    else {
      const agg = new Map<string, { key: string; points: number; members: number }>()
      for (const [uid, pts] of totals) {
        const k = (group === 'university' ? users.get(uid)!.university : users.get(uid)!.t_line) ?? 'Unaffiliated'
        const g = agg.get(k) ?? { key: k, points: 0, members: 0 }
        g.points += pts
        g.members++
        agg.set(k, g)
      }
      rows = [...agg.values()]
    }
    rows.sort((a, b) => b.points - a.points)
    const ranked = rows.map((r, i) => ({ ...r, rank: i + 1, prize: group === 'user' ? PRIZES.find((p) => i + 1 <= p.rank)?.prize ?? null : null }))
    const top = db.recipes.filter((r) => r.t >= since).map(recipeOut).sort((a, b) => b.score - a.score || b.rating_count - a.rating_count).slice(0, 5)
    return delay({ period: period as 'week', group: group as 'user', rows: ranked, top_recipes: top })
  },

  alerts: () => delay(db.alerts.filter((a) => a.user_id === me().id).sort((a, b) => b.t - a.t).map(alertOut)),
  createAlert: (body: AlertIn) => {
    const ingredients = body.ingredients?.length ? body.ingredients : Object.entries(DISHES).find(([k]) => n(body.dish).includes(k) || k.includes(n(body.dish)))?.[1]
    if (!ingredients) return fail('Unknown dish — please list its main ingredients')
    const a: DAlert = { ...body, ingredients, id: ++db.seq, user_id: me().id, active: true, t: now() }
    db.alerts.push(a)
    return delay(alertOut(a))
  },
  deleteAlert: (id) => {
    db.alerts = db.alerts.filter((a) => a.id !== id)
    return delay({ deleted: id })
  },
  dishes: () => delay(DISHES),
  notifications: () => delay(db.notes.filter((x) => x.user_id === me().id).sort((a, b) => b.t - a.t)
    .map(({ user_id: _u, alert_id: _a, t: _t, ...rest }) => rest)),
  markRead: () => {
    db.notes.forEach((x) => { if (x.user_id === me().id) x.read = true })
    return delay({ ok: true })
  },

  suggest: (pantry_id, dietary, culture) => {
    const p = db.pantries.find((x) => x.id === pantry_id)!
    const stock = new Set(latest(pantry_id).filter((i) => i.level !== 'out').map((i) => n(i.name)))
    const ideas: [number, Meal][] = []
    for (const [title, cult, needs, diet, minutes, how] of TEMPLATES) {
      if (dietary.length && !dietary.every((d) => diet.includes(d) || (d === 'Vegetarian' && diet.includes('Vegan')))) continue
      const have = needs.filter((x) => [...stock].some((s) => s.includes(x) || x.includes(s)))
      if (have.length / needs.length < 0.5) continue
      const missing = needs.filter((x) => !have.includes(x))
      ideas.push([have.length / needs.length + (culture && cult.toLowerCase().includes(culture.toLowerCase()) ? 0.3 : 0), {
        title, culture: cult, minutes, uses: have, missing, how,
        substitutions: missing.slice(0, 2).map((m) => `No ${m}? Skip it or swap with what's on the shelf.`),
      }])
    }
    ideas.sort((a, b) => b[0] - a[0])
    return delay({ source: 'fallback' as const, pantry: p.name, meals: ideas.slice(0, 4).map(([, m]) => m) })
  },
}
