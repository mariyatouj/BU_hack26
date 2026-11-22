import test from 'node:test'
import assert from 'node:assert/strict'
import { recipes, sites, start } from '../src/routes/catalog.ts'
import {
  defaults,
  initialState,
  latest,
  editSnapshot,
  coverage,
  minutesLater,
  search,
  candidates,
  surprise,
  savePickup,
  awardMeal,
  balance,
  reserve,
  remaining,
  cancel,
} from '../src/routes/domain.ts'

const dal = recipes.find((r) => r.id === 'dal')
const searchDal = (s) =>
  search(s, { ...defaults, scope: 'pantry', pantryId: 'ruggles' }).find((r) => r.recipe.id === 'dal')
test('each match uses exactly one snapshot and compatible forms; home counts once', () => {
  const s = initialState(),
    snap = latest(s, 'ruggles')
  const eggRice = recipes.find((r) => r.id === 'fried')
  const shelf = {
    ...snap,
    items: ['rice noodles@dry', 'rice@dry', 'egg@shell'].map((key) => ({ ...snap.items[0], key })),
  }
  assert.deepEqual(coverage(eggRice, shelf, start, ['egg@shell']).pantry, ['egg@shell'])
  assert.ok(coverage(eggRice, shelf, start, []).missing.includes('rice@cooked'))
  const first = { ...snap, items: snap.items.slice(0, 2) },
    second = { ...snap, items: snap.items.slice(2) }
  assert.equal(coverage(dal, first, start, []).complete, false)
  assert.equal(coverage(dal, second, start, []).complete, false)
  assert.equal(coverage(dal, first, start, ['onion@standard', 'cumin@standard']).complete, true)
})
test('expiry, closure, stockout and no-op preserve original observations', () => {
  const s = initialState(),
    snap = latest(s, 'ruggles')
  assert.equal(editSnapshot(s, 'ruggles', snap.id, snap.capacity, snap.items), false)
  assert.equal(s.snapshots.length, 8)
  assert.equal(searchDal(s).match.complete, true)
  s.clock = minutesLater(start, 30)
  assert.deepEqual(searchDal(s).match.uncertain, ['red lentils@split dry'])
  editSnapshot(s, 'ruggles', snap.id, snap.capacity, [{ ...snap.items[0], state: 'unavailable' }])
  assert.ok(searchDal(s).match.missing.includes(snap.items[0].key))
  assert.throws(() => editSnapshot(s, 'ruggles', snap.id, 'Closed', []))
  editSnapshot(s, 'ruggles', latest(s, 'ruggles').id, 'Closed', [])
  assert.equal(searchDal(s), undefined)
  assert.equal(snap.items[0].observedAt, snap.startsAt)
  s.clock = snap.endsAt
  assert.deepEqual(search(s, defaults), [])
})
test('directional stop access and walk limit control candidates', () => {
  const searchRoute = (route, walk, direction = '') =>
    candidates({ ...defaults, scope: 'transit', route, walk, direction }).map((c) => c.site.id)
  assert.deepEqual(searchRoute('Orange', 5), ['ruggles'])
  assert.deepEqual(searchRoute('39', 5), [])
  assert.deepEqual(searchRoute('39', 10, 'Back Bay'), ['symphony'])
  assert.ok(searchRoute('Green-E', 5).includes('symphony'))
  assert.ok(!searchRoute('Green-B', 5).includes('symphony'))
  assert.deepEqual(searchRoute('Orange', 10, 'Braintree'), [])
  assert.equal(candidates({ ...defaults, origin: [0, 0], radius: 1 }).length, 0)
})
test('all scopes share hard filters and surprise draws only from eligible results', () => {
  const s = initialState()
  for (const scope of ['radius', 'transit', 'pantry']) {
    const f = { ...defaults, scope, cuisine: 'South Asian', equipment: ['stove'], time: 30, diets: ['Vegan'] }
    const options = search(s, f)
    assert.ok(options.length)
    assert.ok(
      options.every(
        (r) =>
          r.recipe.cuisine === f.cuisine && r.recipe.diet.includes('Vegan') && r.recipe.minutes <= f.time,
      ),
    )
    const pick = surprise(options, [], () => 0)
    assert.notEqual(surprise(options, [pick.id], () => 0).id, pick.id)
    assert.deepEqual(search(s, { ...f, cuisine: 'Korean' }), [])
  }
})
test('attested historical pickup survives stock changes; distinct ingredients, hashes, weekly cap', () => {
  const s = initialState(),
    r = searchDal(s),
    keys = r.match.pantry.slice(0, 3)
  const pickup = savePickup(s, r, keys)
  editSnapshot(s, r.site.id, r.snap.id, 'Closed', [])
  s.clock = minutesLater(start, 24 * 60)
  const submit = (id, items, hash) => awardMeal(s, id, pickup, items, '2026-11-22', hash)
  assert.throws(() => submit('x', [keys[0], keys[0], keys[0]], 'a'))
  assert.throws(() => submit('x', [...keys, 'water@standard'], 'a'))
  assert.throws(() => submit('x', [...keys, 'rice@cooked'], 'a'))
  assert.equal(submit('1', keys, 'a'), true)
  assert.equal(submit('1', keys, 'a'), false)
  assert.throws(() => submit('2', keys, 'a'))
  submit('2', keys, 'b')
  submit('3', keys, 'c')
  assert.throws(() => submit('4', keys, 'd'))
  assert.equal(balance(s), 500)
  assert.ok(s.meals.every((m) => m.publicConsent === false && m.snapshotId === r.snap.id))
})
test('reward reservations are idempotent, bounded and reversible', () => {
  const s = initialState()
  assert.throws(() => reserve(s, 'day', 'bad'))
  s.ledger[0].amount = 1000
  reserve(s, 'week', 'r')
  reserve(s, 'week', 'r')
  assert.equal(balance(s), 300)
  assert.equal(remaining(s, 'week'), 0)
  assert.throws(() => reserve(s, 'week', 'other'))
  cancel(s, 'r')
  cancel(s, 'r')
  reserve(s, 'week', 'r')
  assert.equal(balance(s), 1000)
  assert.equal(remaining(s, 'week'), 1)
  assert.equal(sites.length, 8)
})
