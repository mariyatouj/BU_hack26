import sessionData from '../../../data/routes/sessions.json' with { type: 'json' }
import siteData from '../../../data/routes/sites.json' with { type: 'json' }
import recipeData from '../../../data/routes/recipes.json' with { type: 'json' }
import transitData from '../../../data/routes/transit.json' with { type: 'json' }

export const sessionSeeds = sessionData
export const sites = siteData
export const recipes = recipeData
export type Recipe = (typeof recipes)[number]
export type Site = (typeof sites)[number]
export type Pattern = (typeof transitData.patterns)[number]
export const patterns = transitData.patterns
export const transitSource = transitData.source
export const transitDate = transitData.retrieved
export const stops: Record<string, (typeof transitData.stops)[keyof typeof transitData.stops]> =
  transitData.stops
export const routeName = (id: string) =>
  id === '741'
    ? 'Silver Line SL1'
    : ['1', '39'].includes(id)
      ? 'Bus ' + id
      : id.replace('Green-', 'Green Line ').replace(/^(Orange|Red|Blue)$/, '$1 Line')
export const rules = {
  openingCredit: 200,
  award: 100,
  weeklyLimit: 3,
  maximumPhotos: 20,
  expiryMinutes: 60,
  walkingMetersPerMinute: 80,
} as const
export const start = '2026-11-21T16:00:00.000Z'
export const caps = [
  'Normal distribution',
  'Additional visitors welcome',
  'Limited capacity',
  'Closed',
] as const
export type Capacity = (typeof caps)[number]
export const availability = ['available', 'limited', 'unknown', 'unavailable'] as const
export type Availability = (typeof availability)[number]
export const ingredients = [
  ...new Set(
    recipes.flatMap((r) => r.required.flat()).concat(sessionSeeds.flatMap((s) => s.items.map((i) => i.key))),
  ),
].sort()
export const base = (key: string) => key.split('@')[0]
export const label = (key: string) => {
  const [id, form] = key.split('@')
  const name = id === 'pepper vegetable' ? 'bell pepper' : id
  return form && form !== 'standard' ? name + ' (' + form + ')' : name
}
export const bostonDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
export const bostonTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
export const rewards = [
  {
    id: 'day',
    title: 'MBTA 1-day pass',
    cost: 300,
    quantity: 3,
    coverage: 'One simulated day pass for subway and local bus travel.',
  },
  {
    id: 'week',
    title: 'MBTA 7-day pass',
    cost: 700,
    quantity: 1,
    coverage: 'One simulated week pass for subway and local bus travel.',
  },
  {
    id: 'museum',
    title: 'Museum of Science Planetarium',
    cost: 300,
    quantity: 2,
    coverage: 'One simulated show-only admission.',
  },
].map((product) => ({
  ...product,
  sponsorStatus: 'Proposed sponsorship',
  fulfillmentType: 'Simulated pickup',
  isDemo: true,
  expiresAt: '2026-12-01T05:00:00.000Z',
}))
export const rewardNotice = 'Simulated reward — not a travel or admission ticket'
