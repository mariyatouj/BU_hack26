import {
  availability,
  base,
  bostonDay,
  caps,
  ingredients,
  patterns,
  recipes,
  rewards,
  rules,
  sessionSeeds,
  sites,
  start,
} from './catalog.ts'
import type { Availability, Capacity, Recipe, Site } from './catalog.ts'
import { haversineKm } from '../geo.ts'

export interface Item {
  sourceMode: 'demo'
  key: string
  state: Availability
  observedAt: string
  validUntil: string
  surplus: boolean
}
export interface Snapshot {
  distributionModel: string
  timezone: string
  id: string
  pantryId: string
  sessionId: string
  startsAt: string
  endsAt: string
  observedAt: string
  capacity: Capacity
  sourceMode: 'demo'
  items: Item[]
}
export interface Save {
  id: string
  snapshotId: string
  recipeId: string
  pantryId: string
  received: string[]
  savedAt: string
}
export interface Meal {
  id: string
  pickupId: string
  recipeId: string
  pantryId: string
  snapshotId: string
  ingredientIds: string[]
  cookedAt: string
  photoId: string | null
  hash: string
  status: 'demo accepted'
  publicConsent: false
  localUserId: string
}
interface Entry {
  id: string
  amount: number
  reason: string
  at: string
}
interface Claim {
  pointsCost: number
  id: string
  rewardId: string
  status: 'reserved' | 'canceled'
  at: string
}
export interface State {
  version: 1
  generation: string
  clock: string
  snapshots: Snapshot[]
  saves: Save[]
  meals: Meal[]
  ledger: Entry[]
  claims: Claim[]
}
const uid = () => crypto.randomUUID()
export const minutesLater = (iso: string, minutes: number) =>
  new Date(Date.parse(iso) + minutes * 60000).toISOString()
export function initialState(): State {
  const snapshots = structuredClone(sessionSeeds) as Snapshot[]
  return {
    version: 1,
    generation: uid(),
    clock: start,
    snapshots,
    saves: [],
    meals: [],
    claims: [],
    ledger: [{ id: 'opening', amount: rules.openingCredit, reason: 'Opening demo credit', at: start }],
  }
}
export const latest = (state: State, id: string) => state.snapshots.findLast((s) => s.pantryId === id)!
export const openSession = (s: Snapshot, clock: string) =>
  s.capacity !== 'Closed' && clock >= s.startsAt && clock < s.endsAt
export function status(item: Item, s: Snapshot, clock: string) {
  if (!openSession(s, clock)) return 'session closed'
  if (clock >= item.validUntil) return 'expired'
  return item.state
}
export interface Edit {
  key: string
  state: Availability
  surplus: boolean
  renew?: boolean
}
export function editSnapshot(state: State, id: string, expected: string, capacity: Capacity, edits: Edit[]) {
  const prev = latest(state, id)
  if (!prev || prev.id !== expected)
    throw Error('This session changed in another view. Reopen the editor and review the latest shelf.')
  if (!caps.includes(capacity)) throw Error('Choose a capacity state.')
  const items = prev.items.map((i) => ({ ...i }))
  let changed = capacity !== prev.capacity
  for (const edit of edits) {
    if (!ingredients.includes(edit.key) || !availability.includes(edit.state))
      throw Error('Unknown stock item or availability.')
    const existing = items.find((i) => i.key === edit.key)
    if (existing && existing.state === edit.state && existing.surplus === edit.surplus && !edit.renew)
      continue
    const item: Item = {
      sourceMode: 'demo',
      key: edit.key,
      state: edit.state,
      surplus: edit.surplus,
      observedAt: state.clock,
      validUntil: [minutesLater(state.clock, rules.expiryMinutes), prev.endsAt].sort()[0],
    }
    if (state.clock >= prev.endsAt) throw Error('This distribution session has ended.')
    if (existing) Object.assign(existing, item)
    else items.push(item)
    changed = true
  }
  if (changed) state.snapshots.push({ ...prev, id: uid(), capacity, observedAt: state.clock, items })
  return changed
}
export function coverage(recipe: Recipe, s: Snapshot, clock: string, home: string[]) {
  const pantry: string[] = [],
    owned: string[] = [],
    missing: string[] = [],
    uncertain: string[] = []
  for (const alternatives of recipe.required) {
    const listed = s.items.filter((i) => alternatives.includes(i.key))
    const certain = listed.find((i) => status(i, s, clock) === 'available')
    const atHome = alternatives.find((i) => home.includes(i))
    const maybe = listed.find((i) => ['limited', 'unknown', 'expired'].includes(status(i, s, clock)))
    if (certain) pantry.push(certain.key)
    else if (atHome) owned.push(atHome)
    else if (maybe) uncertain.push(maybe.key)
    else missing.push(alternatives[0])
  }
  return { pantry, owned, missing, uncertain, complete: !missing.length && !uncertain.length }
}

export interface Search {
  scope: 'radius' | 'transit' | 'pantry'
  origin: [number, number]
  radius: number
  route: string
  direction: string
  pantryId: string
  walk: number
  cuisine: string
  diets: string[]
  equipment: string[]
  time: number
  home: string[]
}
export const defaults: Search = {
  scope: 'radius',
  origin: [42.35, -71.085],
  radius: 3,
  route: 'Orange',
  direction: '',
  pantryId: sites[0].id,
  walk: 10,
  cuisine: '',
  diets: [],
  equipment: [],
  time: 120,
  home: [],
}
export function accessFor(site: Site, f: Search) {
  return site.access
    .filter(
      (a) =>
        patterns.some(
          (p) => p.pattern === a.pattern && p.id === f.route && (!f.direction || p.headsign === f.direction),
        ) && Math.ceil(a.meters / rules.walkingMetersPerMinute) <= f.walk,
    )
    .sort((a, b) => a.meters - b.meters)
}
export function candidates(f: Search) {
  return sites
    .map((site) => ({
      site,
      distance: haversineKm(...f.origin, site.lat, site.lng) / 1.609344,
      access: accessFor(site, f),
    }))
    .filter((x) =>
      f.scope === 'pantry'
        ? x.site.id === f.pantryId
        : f.scope === 'transit'
          ? x.access.length > 0
          : x.distance <= f.radius,
    )
    .sort((a, b) =>
      f.scope === 'transit' ? a.access[0].meters - b.access[0].meters : a.distance - b.distance,
    )
}
export function search(state: State, f: Search) {
  return candidates(f)
    .flatMap((c) => {
      const snap = latest(state, c.site.id)
      if (!openSession(snap, state.clock)) return []
      return recipes
        .filter(
          (r) =>
            (!f.cuisine || r.cuisine === f.cuisine) &&
            f.diets.every((d) => r.diet.includes(d)) &&
            (!f.equipment.length || f.equipment.includes(r.equipment)) &&
            r.minutes <= f.time,
        )
        .map((recipe) => {
          const match = coverage(recipe, snap, state.clock, f.home)
          const observed = match.pantry.map((k) => snap.items.find((i) => i.key === k)!.observedAt)
          return {
            ...c,
            recipe,
            snap,
            match,
            id: [c.site.id, recipe.id, snap.id].join('/'),
            ratio: (match.pantry.length + match.owned.length) / recipe.required.length,
            freshness: observed.sort()[0] ?? '',
          }
        })
        .filter((x) => x.match.pantry.length + x.match.uncertain.length > 0)
    })
    .sort(
      (a, b) =>
        b.ratio - a.ratio ||
        b.freshness.localeCompare(a.freshness) ||
        (f.scope === 'transit' ? a.access[0].meters - b.access[0].meters : a.distance - b.distance) ||
        a.recipe.title.localeCompare(b.recipe.title),
    )
}
export type Result = ReturnType<typeof search>[number]
export function surprise(results: Result[], history: string[], random = Math.random) {
  const eligible = results.filter((r) => !history.includes(r.id))
  const pool = eligible.length
    ? eligible
    : [...results].sort((a, b) => history.indexOf(a.id) - history.indexOf(b.id)).slice(0, 1)
  return pool[Math.floor(random() * pool.length)]
}
export function savePickup(state: State, result: Result, received: string[]) {
  const snap = latest(state, result.site.id)
  if (snap.id !== result.snap.id || !openSession(snap, state.clock))
    throw Error('The session changed. Review current availability before saving.')
  const possible = snap.items
    .filter((i) => ['available', 'limited'].includes(status(i, snap, state.clock)))
    .map((i) => i.key)
  if (!received.every((k) => possible.includes(k)))
    throw Error('One of these items is no longer listed for pickup.')
  const existing = state.saves.find(
    (p) =>
      p.snapshotId === snap.id &&
      p.recipeId === result.recipe.id &&
      p.savedAt === state.clock &&
      p.received.length === new Set(received).size &&
      received.every((k) => p.received.includes(k)),
  )
  if (existing) return existing.id
  const save: Save = {
    id: uid(),
    snapshotId: snap.id,
    pantryId: snap.pantryId,
    recipeId: result.recipe.id,
    received: [...new Set(received)],
    savedAt: state.clock,
  }
  state.saves.push(save)
  return save.id
}
export const balance = (state: State) => state.ledger.reduce((sum, e) => sum + e.amount, 0)
export const remaining = (state: State, id: string) =>
  (rewards.find((r) => r.id === id)?.quantity ?? 0) -
  state.claims.filter((c) => c.rewardId === id && c.status === 'reserved').length
export function awardMeal(
  state: State,
  id: string,
  pickupId: string,
  selected: string[],
  date: string,
  hash: string,
) {
  if (state.meals.some((m) => m.id === id)) return false
  const save = state.saves.find((p) => p.id === pickupId)
  if (!save) throw Error('Save a pickup first.')
  if (!hash || state.meals.some((m) => m.hash === hash))
    throw Error('This photo has already been submitted or is unavailable.')
  const distinct = [...new Set(selected.map(base))]
  if (distinct.length < 3 || distinct.includes('water') || !selected.every((k) => save.received.includes(k)))
    throw Error('Confirm three distinct food ingredients received in this pickup.')
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || date < bostonDay(save.savedAt) || date > bostonDay(state.clock))
    throw Error('Choose a cooking date between pickup and simulated today.')
  const since = minutesLater(state.clock, -7 * 24 * 60)
  if (state.ledger.filter((e) => e.reason === 'Cooking award' && e.at > since).length >= rules.weeklyLimit)
    throw Error('Three awards have already been earned in the last seven days.')
  state.meals.push({
    id,
    pickupId,
    recipeId: save.recipeId,
    pantryId: save.pantryId,
    snapshotId: save.snapshotId,
    ingredientIds: distinct,
    cookedAt: date,
    photoId: id,
    hash,
    status: 'demo accepted',
    publicConsent: false,
    localUserId: state.generation,
  })
  state.ledger.push({ id, amount: rules.award, reason: 'Cooking award', at: state.clock })
  return true
}
export function reserve(state: State, rewardId: string, id: string) {
  if (state.claims.some((c) => c.id === id)) return
  const r = rewards.find((r) => r.id === rewardId)
  if (!r || remaining(state, r.id) < 1) throw Error('No demo stock remains.')
  if (state.clock >= r.expiresAt) throw Error('This demo allocation has expired.')
  if (balance(state) < r.cost) throw Error('Insufficient points.')
  state.claims.push({ id, rewardId, pointsCost: r.cost, status: 'reserved', at: state.clock })
  state.ledger.push({ id, amount: -r.cost, reason: r.title, at: state.clock })
}
export function cancel(state: State, id: string) {
  const c = state.claims.find((c) => c.id === id)
  if (!c || c.status === 'canceled') return
  c.status = 'canceled'
  const r = rewards.find((r) => r.id === c.rewardId)!
  state.ledger.push({
    id: id + '-refund',
    amount: c.pointsCost ?? -state.ledger.find((e) => e.id === c.id)!.amount,
    reason: r.title + ' refund',
    at: state.clock,
  })
}
