import { useEffect, useMemo, useState } from 'react'
import { getOneTimeLocation } from '../location'
import type { Directions } from '../types'
import { useRoutes } from './context'
import {
  bostonTime,
  ingredients,
  label,
  patterns,
  recipes,
  routeName,
  rules,
  sites,
  stops,
  type Site,
} from './catalog'
import {
  accessFor,
  candidates,
  defaults,
  latest,
  openSession,
  savePickup,
  search,
  status,
  surprise,
  type Result,
  type Search,
} from './domain'
import RouteMap from './RouteMap'
import featuredPhoto from '../assets/demo/lentil-dal.jpg'

const unique = (values: string[]) => [...new Set(values)].sort()
const switchValue = (arr: string[], key: string) =>
  arr.includes(key) ? arr.filter((i) => i !== key) : [...arr, key]
const names = (arr: string[]) => arr.map(label).join(', ') || 'None'

export function Checks({
  legend,
  values,
  selected,
  change,
  format = (s) => s,
}: {
  legend: string
  values: string[]
  selected: string[]
  change: (keys: string[]) => void
  format?: (s: string) => string
}) {
  return (
    <fieldset className="checks-fieldset">
      <legend>{legend}</legend>
      <div className="checks">
        {values.map((k) => (
          <label key={k} className={selected.includes(k) ? 'check-label active' : 'check-label'}>
            <input
              type="checkbox"
              checked={selected.includes(k)}
              onChange={() => change(switchValue(selected, k))}
            />
            <span>{format(k)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Access({ site, f }: { site: Site; f: Search }) {
  const access =
    f.scope === 'transit' ? accessFor(site, f)[0] : [...site.access].sort((a, b) => a.meters - b.meters)[0]
  if (!access) return null
  const pattern = patterns.find((p) => p.pattern === access.pattern)!
  return (
    <details className="walk">
      <summary>
        {routeName(pattern.id)} · {stops[access.stop].name} ·{' '}
        {Math.ceil(access.meters / rules.walkingMetersPerMinute)} min walk
      </summary>
      <div className="walk-body">
        <p>
          Toward <strong>{pattern.headsign}</strong> · {stops[access.entrance].name} entrance. Estimated {access.meters} m at{' '}
          {rules.walkingMetersPerMinute} m/min. Return stop{' '}
          {access.returnStop ? stops[access.returnStop].name : 'unreviewed'}.
        </p>
        <p className="muted small">
          {access.method}. {access.accessibility}. Reviewed {access.verifiedAt}.
        </p>
      </div>
    </details>
  )
}

function DirectionsPanel({ site, origin }: { site: Site; origin: [number, number] }) {
  const [data, setData] = useState<Directions | null>(null),
    [msg, setMsg] = useState('')
  const url =
    'https://www.google.com/maps/dir/?api=1&destination=' +
    encodeURIComponent(site.lat + ',' + site.lng) +
    '&travelmode='
  async function departures() {
    setMsg('Checking nearby stops…')
    try {
      const res = await fetch((import.meta.env.VITE_API_URL ?? '') + '/api/routes/directions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: site.id, origin_lat: origin[0], origin_lng: origin[1] }),
        cache: 'no-store',
        signal: AbortSignal.timeout(14000),
      })
      if (!res.ok) throw Error()
      const d: Directions = await res.json()
      setData(d)
      setMsg(d.live ? '' : d.warnings.join(' '))
    } catch {
      setMsg('Live transit is unavailable. Bundled stops and the trip planner are available.')
    }
  }
  return (
    <details className="directions-details">
      <summary>Directions and live departures</summary>
      <div className="directions-content">
        <div className="row directions-actions">
          <a className="btn small" href={url + 'transit'} target="_blank" rel="noreferrer">
            Transit planner ↗
          </a>
          <a className="btn small" href={url + 'driving'} target="_blank" rel="noreferrer">
            Driving directions ↗
          </a>
          <button className="btn small" onClick={departures}>
            Check live departures
          </button>
        </div>
        <small className="muted directions-note">
          Uses your selected origin once for nearby stops. The planner receives the destination only. Fictional
          pickup site.
        </small>
        {msg && <p className="directions-msg" role="status">{msg}</p>}
        {data?.live && (
          <div className="departures-live">
            <p className="departures-head">Transit lookup {bostonTime(data.generated_at)} · nearby departures</p>
            <div className="predictions-list">
              {data.predictions.slice(0, 6).map((p) => (
                <div className="prediction-item" key={p.id}>
                  <span className="pred-route">{p.route.name}</span>
                  <span className="pred-stop">
                    {[...data.origin_stops, ...data.destination_stops].find((s) => s.id === p.stop_id)?.name ??
                      p.stop_id}
                  </span>
                  <span className="pred-min">
                    {p.minutes === null ? 'time unavailable' : p.minutes + ' min'}
                  </span>
                </div>
              ))}
            </div>
            {data.warnings.map((w) => (
              <p key={w} className="muted small">{w}</p>
            ))}
            {data.alerts.slice(0, 2).map((a) => (
              <p key={a.id} className="transit-alert-pill">{a.header}</p>
            ))}
          </div>
        )}
      </div>
    </details>
  )
}

function RecipeDetail({ result }: { result: Result }) {
  const { state, write } = useRoutes(),
    { recipe, match, snap } = result
  const [received, setReceived] = useState<string[]>([]),
    [tip, setTip] = useState('')
  const usable = snap.items
    .filter((i) => ['available', 'limited'].includes(status(i, snap, state.clock)))
    .map((i) => i.key)
  const selected = received.filter((k) => usable.includes(k))
  async function getTip() {
    setTip('Preparing cooking guidance…')
    try {
      const r = await fetch((import.meta.env.VITE_API_URL ?? '') + '/api/routes/adapt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe_id: recipe.id,
          pantry: match.pantry,
          home: match.owned,
          missing: match.missing,
          uncertain: match.uncertain,
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (!r.ok) throw Error()
      const d = await r.json()
      if (typeof d.tip !== 'string') throw Error()
      setTip((d.source === 'gemini' ? 'Gemini guidance' : 'Catalog guidance') + ' · ' + d.tip)
    } catch {
      setTip('Offline catalog guidance · ' + recipe.steps[0])
    }
  }
  return (
    <div className="recipe-detail">
      <div className="recipe-meta-bar">
        <span className="recipe-chip servings">{recipe.servings} servings</span>
        <span className="recipe-chip equipment">{recipe.equipment}</span>
        <span className="recipe-chip cooktime">{recipe.minutes} min</span>
        <span className="recipe-chip diet">{recipe.diet.join(', ')}</span>
      </div>
      <p className="recipe-quantities-note muted small">
        Quantities on the shelf are unknown. Bring home what your household will use.
      </p>
      <dl className="coverage">
        <dt>Listed at this pantry</dt>
        <dd>{names(match.pantry)}</dd>
        <dt>Already at home</dt>
        <dd>{names(match.owned)}</dd>
        <dt>Needs confirmation</dt>
        <dd>{names(match.uncertain)}</dd>
        <dt>Required and missing</dt>
        <dd>{names(match.missing)}</dd>
        <dt>Optional extras</dt>
        <dd>{names(recipe.optional)}</dd>
      </dl>
      {recipe.required
        .filter((g) => g.length > 1)
        .map((g) => (
          <p className="sub-note" key={g[0]}>Reviewed substitution · {g.map(label).join(' or ')}</p>
        ))}
      <div className="recipe-steps-wrap">
        <h4>Preparation steps</h4>
        <ol>
          {recipe.steps.map((s, i) => (
            <li key={i}>{s.replace(/\.$/, '')}.</li>
          ))}
        </ol>
      </div>
      <p className="muted small">
        {recipe.source} · {recipe.license}. Check packaged ingredient and allergen labels.
      </p>
      <a className="recipe-permalink" href={'#explore/' + result.site.id + '/' + recipe.id}>Link to this pantry recipe</a>
      <div className="row recipe-actions">
        <button className="btn small" onClick={getTip}>
          Cooking guidance
        </button>
        <button
          className="btn small"
          onClick={() =>
            write((s) => {
              if (
                !s.saves.some(
                  (p) => p.recipeId === recipe.id && p.snapshotId === snap.id && !p.received.length,
                )
              )
                savePickup(s, result, [])
            }, 'Recipe and inventory snapshot saved.')
          }
        >
          Save recipe
        </button>
      </div>
      {tip && <p className="recipe-tip" role="status">{tip}</p>}
      <details className="record-pickup-drawer">
        <summary>Record pickup</summary>
        <div className="pickup-form">
          <Checks
            legend="Which ingredients did you actually receive here?"
            values={usable}
            selected={selected}
            change={setReceived}
            format={label}
          />
          <button
            className="btn primary"
            disabled={!selected.length}
            onClick={() =>
              write((s) => {
                savePickup(s, result, selected)
              }, 'Pickup saved. Open Cooking to record a meal.')
            }
          >
            Save pickup
          </button>
        </div>
      </details>
    </div>
  )
}

export default function Explore({ f, setF }: { f: Search; setF: (f: Search) => void }) {
  const { state, notify } = useRoutes()
  const [origin, setOrigin] = useState(''),
    [query, setQuery] = useState(''),
    [active, setActive] = useState(''),
    [more, setMore] = useState<string[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [mapOpen, setMapOpen] = useState(false)
  const change = (v: Partial<Search>) => setF({ ...f, ...v })
  const results = useMemo(
    () => search(state, f).filter((x) => x.recipe.title.toLowerCase().includes(query.trim().toLowerCase())),
    [state, f, query],
  )
  const places = candidates(f)
  const constraints = [
    f.cuisine,
    ...f.diets,
    ...f.equipment,
    f.time < 120 ? 'up to ' + f.time + ' min' : '',
    query.trim(),
  ].filter(Boolean)
  const listed = places.filter(
    (p) =>
      results.some((r) => r.site.id === p.site.id) ||
      f.scope === 'pantry' ||
      !openSession(latest(state, p.site.id), state.clock),
  )
  const matchingPantries = new Set(results.map((result) => result.site.id)).size
  const ranked = [...listed].sort((a, b) => {
    const i = results.findIndex((r) => r.site.id === a.site.id),
      j = results.findIndex((r) => r.site.id === b.site.id)
    return (i < 0 ? Infinity : i) - (j < 0 ? Infinity : j)
  })
  useEffect(() => {
    if (active) document.getElementById('meal-' + active)?.scrollIntoView({ block: 'nearest' })
  }, [active])
  useEffect(() => {
    function openLink() {
      const [page, site, recipe] = location.hash.slice(1).split('/')
      if (page === 'explore' && sites.some((s) => s.id === site) && recipes.some((r) => r.id === recipe))
        setActive(site + '/' + recipe)
    }
    openLink()
    window.addEventListener('hashchange', openLink)
    return () => window.removeEventListener('hashchange', openLink)
  }, [])
  const choose = (id: string) => {
    setActive('')
    change({ scope: 'pantry', pantryId: id })
  }
  const chooseFromMap = (id: string) => {
    choose(id)
    document.getElementById('pantry-results')?.focus()
  }
  const pick = () => {
    const r = surprise(results, history)
    if (r) {
      setMore((v) => unique([...v, r.site.id]))
      setHistory((v) => [...v.filter((x) => x !== r.id), r.id].slice(-3))
      setActive(r.site.id + '/' + r.recipe.id)
    }
  }
  const locate = () => {
    const site = sites.find((s) =>
      [s.neighborhood.toLowerCase(), s.zip, s.name.toLowerCase()].includes(origin.toLowerCase().trim()),
    )
    if (!site) {
      notify('Choose a neighborhood or ZIP from the bundled list.')
      return
    }
    change({ origin: [site.lat, site.lng] })
    notify('Search centered near ' + site.neighborhood)
  }
  return (
    <>
      <header className="explore-intro">
        <div className="intro-copy">
          <h1>Cook Your Next Meal At Home–And Pay Nothing for the Ingredients</h1>
          <p>Find meals using real-time stock from a Boston pantry and ingredients already in your kitchen.</p>
          <a
            className="intro-link"
            href="#pantry-results"
            onClick={(event) => {
              event.preventDefault()
              document.getElementById('pantry-results')?.focus()
            }}
          >
            Browse matching recipes <span aria-hidden="true">↓</span>
          </a>
        </div>
        <a
          className="featured-recipe"
          href="#explore/ruggles/dal"
          aria-label="Featured recipe, tomato masoor dal"
        >
          <img src={featuredPhoto} alt="" width="1000" height="666" />
          <span>
            Tomato masoor dal <span aria-hidden="true">↗</span>
          </span>
        </a>
      </header>
      <div className="explore-layout">
        <section className="search-tools" aria-labelledby="search-heading">
          <div className="search-tools-header">
            <h2 id="search-heading">Find a pantry</h2>
          </div>
          <div className="segmented" aria-label="Search scope">
            {(['radius', 'transit', 'pantry'] as const).map((s, i) => (
              <button key={s} aria-pressed={f.scope === s} onClick={() => change({ scope: s })}>
                {['Near me', 'Along transit', 'One pantry'][i]}
              </button>
            ))}
          </div>
          {f.scope === 'radius' && (
            <>
              <form
                className="origin"
                onSubmit={(e) => {
                  e.preventDefault()
                  locate()
                }}
              >
                <label>
                  Neighborhood or ZIP
                  <input
                    list="origins"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="Roxbury or 02120"
                  />
                </label>
                <datalist id="origins">
                  {unique(sites.flatMap((s) => [s.neighborhood, s.zip])).map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </datalist>
                <button className="btn">Set origin</button>
              </form>
              <div className="radius-tools">
                <button
                  className="btn small"
                  onClick={async () => {
                    try {
                      const l = await getOneTimeLocation()
                      change({ origin: [l.lat, l.lng] })
                      notify('Updated search origin.')
                    } catch (e) {
                      notify((e as Error).message)
                    }
                  }}
                >
                  Use my location
                </button>
                <label>
                  Radius{' '}
                  <select value={f.radius} onChange={(e) => change({ radius: +e.target.value })}>
                    {[1, 3, 5, 10].map((n) => (
                      <option value={n} key={n}>
                        {n} miles
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}
          {f.scope === 'transit' && (
            <div className="filters-grid">
              <label>
                Line or bus route
                <select value={f.route} onChange={(e) => change({ route: e.target.value, direction: '' })}>
                  {unique(patterns.map((p) => p.id)).map((id) => (
                    <option key={id} value={id}>
                      {routeName(id)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Direction or branch
                <select value={f.direction} onChange={(e) => change({ direction: e.target.value })}>
                  <option value="">Either direction</option>
                  {unique(patterns.filter((p) => p.id === f.route).map((p) => p.headsign)).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label>
                Maximum walk
                <select value={f.walk} onChange={(e) => change({ walk: +e.target.value })}>
                  {[5, 10, 15].map((n) => (
                    <option key={n} value={n}>
                      {n} minutes
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {f.scope === 'pantry' && (
            <label className="pantry-picker-label">
              Pantry
              <select aria-label="Pantry" value={f.pantryId} onChange={(e) => choose(e.target.value)}>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="filters-grid recipe-filters">
            <label>
              Cuisine or region
              <select value={f.cuisine} onChange={(e) => change({ cuisine: e.target.value })}>
                <option value="">Explore all cuisines</option>
                {unique(recipes.map((r) => r.cuisine)).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Find a recipe
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Recipe name (e.g. dal, tacos)"
              />
            </label>
          </div>
          <details className="extra-filters">
            <summary>Diet, equipment, time and home ingredients</summary>
            <div className="extra-filters-content">
              <Checks
                legend="Dietary preferences"
                values={unique(recipes.flatMap((r) => r.diet))}
                selected={f.diets}
                change={(diets) => change({ diets })}
              />
              <Checks
                legend="Available equipment"
                values={unique(recipes.map((r) => r.equipment))}
                selected={f.equipment}
                change={(equipment) => change({ equipment })}
              />
              <label>
                Preparation time
                <select value={f.time} onChange={(e) => change({ time: +e.target.value })}>
                  {[10, 20, 30, 45, 120].map((n) => (
                    <option key={n} value={n}>
                      Up to {n} min
                    </option>
                  ))}
                </select>
              </label>
              <div className="home-ingredients-wrap">
                <Checks
                  legend="I already have"
                  values={ingredients}
                  selected={f.home}
                  change={(home) => change({ home })}
                  format={label}
                />
              </div>
            </div>
          </details>
        </section>
        <section className="map-panel" aria-label="Pantry map">
          <button
            className="btn map-toggle"
            aria-expanded={mapOpen}
            aria-controls="explore-map"
            onClick={() => setMapOpen(!mapOpen)}
          >
            {mapOpen ? 'Hide pantry map' : 'Show pantry map'}
          </button>
          <div id="explore-map" className={mapOpen ? 'map-content map-open' : 'map-content'}>
            <RouteMap
              f={f}
              sites={ranked.map((c) => c.site)}
              onOrigin={(pos) => change({ origin: pos, scope: 'radius' })}
              onSite={chooseFromMap}
            />
          </div>
        </section>
        <section className="results-panel" aria-labelledby="pantry-results">
          <div className="results-heading">
            <div>
              <h2 id="pantry-results" tabIndex={-1}>
                Recipes by pantry
              </h2>
              <p>
                {results.length} {results.length === 1 ? 'match' : 'matches'} across {matchingPantries}{' '}
                {matchingPantries === 1 ? 'pantry' : 'pantries'}
              </p>
            </div>
            <button className="btn" disabled={!results.length} onClick={pick}>
              Surprise me
            </button>
          </div>
          {!results.length && (
            <div className="empty">
              <p>
                {!places.length
                  ? 'No pantry falls within the selected radius, route or walking limit.'
                  : !places.some((c) => openSession(latest(state, c.site.id), state.clock))
                    ? 'Distribution sessions in this scope are closed.'
                    : 'No session recipe meets ' +
                      (constraints.join(', ') || 'the available stock') +
                      ' within this scope.'}
              </p>
              <button
                className="btn primary"
                onClick={() => {
                  setF({ ...defaults, origin: f.origin, radius: 10 })
                  setQuery('')
                  setActive('')
                }}
              >
                Search all cuisines within 10 miles
              </button>
            </div>
          )}
          <div className="results">
            {ranked.map(({ site, distance }) => {
              const snap = latest(state, site.id),
                matches = results.filter((r) => r.site.id === site.id),
                open = openSession(snap, state.clock)
              const surplus = snap.items.filter(
                (i) =>
                  i.surplus &&
                  snap.capacity === 'Additional visitors welcome' &&
                  status(i, snap, state.clock) === 'available',
              )
              const all = f.scope === 'pantry' || more.includes(site.id)
              const availableCount = snap.items.filter(
                (i) => status(i, snap, state.clock) === 'available',
              ).length
              return (
                <article className="result-card" key={site.id}>
                  <header className="card-header">
                    <div>
                      <div className="card-badges">
                        <span className="hood-badge">{site.neighborhood}</span>
                        <span className="demo-tag">Fictional pantry</span>
                      </div>
                      <h2>
                        <button className="title-button" onClick={() => choose(site.id)}>
                          {site.name}
                        </button>
                      </h2>
                    </div>
                    <span className="tag distance-tag">{distance.toFixed(1)} mi straight-line</span>
                  </header>
                  <div className="session-status-row">
                    <span className={open ? 'status-indicator open' : 'status-indicator closed'}>
                      ● {open ? 'Open Now' : 'Closed'}
                    </span>
                    <p className="session-time">
                      <b>{open ? snap.capacity : 'Session closed'}</b> · {bostonTime(snap.startsAt)} –{' '}
                      {bostonTime(snap.endsAt)} ET
                    </p>
                    <span className="stock-count-pill">
                      {availableCount} items in stock
                    </span>
                  </div>
                  {surplus.length > 0 && (
                    <div className="surplus">
                      <strong>Surplus available</strong> ·{' '}
                      {surplus.map((i) => label(i.key) + ' until ' + bostonTime(i.validUntil)).join(', ')}
                    </div>
                  )}
                  <div className="meal-list">
                    {matches.length > 0 && (
                      <div className="meal-list-head">
                        <p className="meal-list-label">Matches use demo inventory</p>
                        <span className="recipe-count-badge">{matches.length} recipes</span>
                      </div>
                    )}
                    {(all ? matches : matches.slice(0, 3)).map((r) => {
                      const key = site.id + '/' + r.recipe.id
                      return (
                        <section className="meal-row" id={'meal-' + key} key={key}>
                          <button
                            className="meal-button"
                            aria-expanded={active === key}
                            onClick={() => setActive(active === key ? '' : key)}
                          >
                            <div className="meal-heading-group">
                              <strong>{r.recipe.title}</strong>
                              <span className="meal-meta">
                                {r.recipe.cuisine} · {r.recipe.minutes} min
                              </span>
                            </div>
                            <span className="meal-chevron" aria-hidden="true">
                              ⌄
                            </span>
                          </button>
                          <p className="match-line" data-complete={r.match.complete}>
                            {r.match.pantry.length} listed here · {r.match.owned.length} at home ·{' '}
                            {r.match.missing.length} more needed
                            {r.match.uncertain.length > 0
                              ? ' · ' + r.match.uncertain.length + ' need confirmation'
                              : ''}
                            {r.match.complete ? ' · All required ingredients covered' : ''}
                          </p>
                          {active === key && (
                            <RecipeDetail key={r.id + state.clock + JSON.stringify(r.match)} result={r} />
                          )}
                        </section>
                      )
                    })}
                    {!all && matches.length > 3 && (
                      <button className="link all-recipes" onClick={() => setMore((v) => [...v, site.id])}>
                        Show all {matches.length} recipes
                      </button>
                    )}
                  </div>
                  <div className="pantry-details">
                    <Access site={site} f={f} />
                    <details className="pantry-inventory-details">
                      <summary>Pantry details and demo inventory</summary>
                      <div className="pantry-profile-inner">
                        <div className="pantry-info-grid">
                          <div>
                            <strong>Service Guidelines</strong>
                            <p>{site.instructions} {site.serviceArea}.</p>
                          </div>
                          <div>
                            <strong>Address & Parking</strong>
                            <p>{site.address}. Parking {site.parking.toLowerCase()}.</p>
                          </div>
                          <div>
                            <strong>Contact</strong>
                            <p>{site.contact}.</p>
                          </div>
                        </div>
                        <p className="muted small pantry-source-line">
                          Source {site.source} ({site.retrievedAt}). Updated {bostonTime(snap.observedAt)} ET.
                        </p>
                        <h4 className="shelf-heading">Current Demo Shelf</h4>
                        <ul className="shelf-list">
                          {snap.items.map((i) => {
                            const itStatus = status(i, snap, state.clock)
                            return (
                              <li key={i.key} className={'shelf-item status-' + itStatus.replace(/\s+/g, '-')}>
                                <div className="shelf-item-top">
                                  <b>{label(i.key)}</b>
                                  <span className="shelf-status-pill">{itStatus}</span>
                                </div>
                                <small>
                                  Observed {bostonTime(i.observedAt)} · valid until {bostonTime(i.validUntil)} ET
                                </small>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    </details>
                    <DirectionsPanel key={site.id + f.origin.join('/')} site={site} origin={f.origin} />
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </>
  )
}
