import { useEffect, useMemo, useState } from 'react'
import BostonMap from '../components/BostonMap'
import PantrySheet, { type SheetPosition } from '../components/PantrySheet'
import { Chips, DIETS, CULTURES, LEVEL_LABEL, Modal, Stars, StockBar, ago } from '../components/ui'
import { useApp } from '../context'
import { haversineKm } from '../geo'
import { getOneTimeLocation } from '../location'
import type { Directions, Meal, PantryDetail, Pantry, RecipeIn, Suggestion } from '../types'
import ShareRecipe from './ShareRecipe'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MODEL_LABEL: Record<string, string> = {
  'client-choice': 'Client choice — pick your own items',
  'pre-packed': 'Pre-packed boxes',
  mobile: 'Mobile / free fridge',
  'drive-thru': 'Drive-thru pickup',
  unknown: 'Call pantry to confirm distribution',
}

const SHORT: Record<string, string> = { 'client-choice': 'Client choice', 'pre-packed': 'Pre-packed', mobile: 'Mobile / fridge', 'drive-thru': 'Drive-thru', unknown: 'Call ahead' }

function openToday(p: Pantry) {
  const today = DAYS[new Date().getDay()]
  const hours = p.hours[today] ?? p.hours['Daily']
  return hours && !/^closed$/i.test(hours.trim()) ? hours : null
}

const hasVerifiedHours = (p: Pantry) => Object.keys(p.hours).length > 0

export default function PantriesView() {
  const { api, pantries, loc, setLoc, focusPantry, toast } = useApp()
  const [sel, setSel] = useState<number | null>(focusPantry)
  const [position, setPosition] = useState<SheetPosition>('half')
  const [dishesByPantry, setDishesByPantry] = useState<Map<number, string[]>>(new Map())
  const [recipeVersion, setRecipeVersion] = useState(0)
  const [feature, setFeature] = useState<string[]>([])
  const [model, setModel] = useState<string[]>([])
  const [todayOnly, setTodayOnly] = useState(false)
  const [locating, setLocating] = useState(false)

  const selectPantry = (id: number) => {
    setSel(id)
    setPosition((current) => current === 'collapsed' ? 'half' : current)
  }

  useEffect(() => {
    let active = true
    api.recipes({ sort: 'top' }).then((recipes) => {
      if (!active) return
      const grouped = new Map<number, string[]>()
      for (const recipe of recipes) {
        if (!recipe.pantry) continue
        const titles = grouped.get(recipe.pantry.id) ?? []
        if (titles.length < 2) {
          titles.push(recipe.title)
          grouped.set(recipe.pantry.id, titles)
        }
      }
      setDishesByPantry(grouped)
    }).catch(() => {
      if (active) setDishesByPantry(new Map())
    })
    return () => { active = false }
  }, [api, recipeVersion])

  const features = useMemo(() => [...new Set(pantries.flatMap((p) => p.features))].sort(), [pantries])
  const shown = pantries.filter((p) =>
    feature.every((f) => p.features.includes(f)) && (!model.length || model.includes(p.distribution_model)) && (!todayOnly || openToday(p)))
  const dim = new Set(pantries.filter((p) => !shown.includes(p)).map((p) => p.id))

  const useMyLocation = async () => {
    setLocating(true)
    try {
      const here = await getOneTimeLocation()
      setLoc([here.lat, here.lng])
      toast(`Map centered near you${here.accuracy_m ? ` · ±${here.accuracy_m} m` : ''}`)
    } catch (error) {
      toast((error as Error).message)
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="pantry-explorer">
      <section className="explorer-map" aria-label="Pantry map">
        <BostonMap fit="meet" pantries={pantries} selectedId={sel} onSelect={selectPantry} you={loc} onMoveYou={(a, b) => setLoc([a, b])} dimIds={dim} />
        <div className="explorer-map-tools">
          <div className="location-action">
            <button className="btn small primary" onClick={useMyLocation} disabled={locating}>
              {locating ? 'Finding you…' : 'Use my location'}
            </button>
            <span>Used in this tab only · not saved</span>
          </div>
          <div className="map-legend">
            <span><i className="dot good" />Plenty</span><span><i className="dot mid" />Some</span><span><i className="dot bad" />Running low</span>
            <span className="muted">Illustrative transit routes</span>
            <span className="muted">Tap the map to move your location</span>
          </div>
        </div>
      </section>
      <PantrySheet position={position} onPositionChange={setPosition} count={shown.length} total={pantries.length}>
        {sel ? (
          <Detail id={sel} onBack={() => setSel(null)} onRecipeShared={() => setRecipeVersion((version) => version + 1)} />
        ) : (
          <>
            <details className="sheet-filters">
              <summary>Filters <span className="muted small">· Sorted by distance</span></summary>
              <div className="filters">
                <label className="switch"><input type="checkbox" checked={todayOnly} onChange={(e) => setTodayOnly(e.target.checked)} /> Open today</label>
                <Chips options={Object.keys(MODEL_LABEL).map((k) => SHORT[k])} value={model.map((k) => SHORT[k])} onChange={(v) => setModel(v.map((l) => Object.keys(SHORT).find((k) => SHORT[k] === l)!))} />
                <details>
                  <summary>Features {feature.length ? `(${feature.length})` : ''}</summary>
                  <Chips options={features} value={feature} onChange={setFeature} multi />
                </details>
              </div>
            </details>
            <ul className="plist">
              {shown.map((p) => (
                <li key={p.id}>
                  <button className="pcard" onClick={() => selectPantry(p.id)}>
                    <span className={`lvl ${p.inventory_level}`} aria-label={`Inventory ${p.inventory_level}`} />
                    <span className="pcard-main">
                      <strong>{p.name}</strong>
                      <span className="muted">{p.neighborhood} · {SHORT[p.distribution_model]}</span>
                      <span className="pcard-meta">
                        {p.rating ? <><Stars value={p.rating} /> <span>{p.rating}</span></> : <span className="muted">No ratings</span>}
                        <span className={openToday(p) ? 'open' : 'muted'}>
                          {openToday(p) ? `Open today ${openToday(p)}` : hasVerifiedHours(p) ? 'Closed today' : 'Hours not verified — call ahead'}
                        </span>
                      </span>
                      {dishesByPantry.get(p.id)?.length ? (
                        <span className="pcard-dishes"><strong>Community dishes</strong> {dishesByPantry.get(p.id)?.join(' · ')}</span>
                      ) : null}
                    </span>
                    <span className="pcard-dist">{p.distance_km?.toFixed(1) ?? '–'}<small> km</small></span>
                  </button>
                </li>
              ))}
              {!shown.length && <li className="empty">No pantries match these filters.</li>}
            </ul>
            <p className="muted small directory-note">Locations are historical public directory records; colored stock levels are demo values. <a href="https://www.gbfb.org/need-food/" target="_blank" rel="noreferrer">Check the current GBFB locator ↗</a></p>
            <SubmitPantry />
          </>
        )}
      </PantrySheet>
    </div>
  )
}

function Detail({ id, onBack, onRecipeShared }: { id: number; onBack: () => void; onRecipeShared: () => void }) {
  const { api, loc, celebrate, toast, reloadPantries, gemini, mode } = useApp()
  const [p, setP] = useState<PantryDetail | null>(null)
  const [rating, setRating] = useState(false)
  const [stock, setStock] = useState(false)
  const [diet, setDiet] = useState<string[]>([])
  const [culture, setCulture] = useState('')
  const [sug, setSug] = useState<Suggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [share, setShare] = useState<Partial<RecipeIn> | null>(null)
  const [directions, setDirections] = useState<Directions | null>(null)
  const [directionsBusy, setDirectionsBusy] = useState(false)
  const [directionsError, setDirectionsError] = useState('')

  const load = () => api.pantry(id).then(setP)
  useEffect(() => { setSug(null); load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return <p className="muted">Loading…</p>
  const today = DAYS[new Date().getDay()]
  const byCat = p.items.reduce<Record<string, typeof p.items>>((a, i) => ((a[i.category] ??= []).push(i), a), {})

  const suggest = async () => {
    setLoading(true)
    try { setSug(await api.suggest(p.id, diet, culture || null)) } finally { setLoading(false) }
  }
  const visit = async () => {
    const r = await api.visit(p.id)
    if (r.points_earned) celebrate(r, 'Checked in')
    else toast(r.message ?? 'Already checked in')
    load()
  }
  const getDirections = async () => {
    setDirectionsBusy(true)
    setDirectionsError('')
    setDirections(null)
    try {
      // Kept in this function only: it is sent once for routing and never stored in app state.
      const origin = await getOneTimeLocation()
      setDirections(await api.directions(p.id, origin.lat, origin.lng))
    } catch (error) {
      setDirectionsError((error as Error).message)
    } finally {
      setDirectionsBusy(false)
    }
  }
  const fromMeal = (m: Meal): Partial<RecipeIn> => ({
    title: m.title, description: m.how, ingredients: [...m.uses, ...m.missing], culture_tags: [m.culture], pantry_id: p.id, minutes: m.minutes,
  })
  const distanceKm = haversineKm(loc[0], loc[1], p.lat, p.lng)
  const fallbackDirections = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${p.lat},${p.lng}`)}&travelmode=transit`

  return (
    <div className="detail">
      <button className="back" onClick={onBack}>← All pantries</button>
      <header className="detail-head">
        <h1>{p.name}</h1>
        <p className="muted">{p.address} · {p.neighborhood} · {distanceKm.toFixed(1)} km away</p>
        <div className="row">
          {p.rating ? <><Stars value={p.rating} /><span>{p.rating} ({p.rating_count})</span></> : <span className="muted">No ratings yet</span>}
          <span className={`badge ${p.inventory_level}`}>Inventory: {LEVEL_LABEL[p.inventory_level]}</span>
          {p.inventory_status === 'demo' && <span className="badge">Demo inventory</span>}
          {p.inventory_status === 'mixed' && <span className="badge">Demo + reported inventory</span>}
          {p.source_url ? <span className="badge ok">Public directory record</span> : p.verified && <span className="badge ok">Community verified</span>}
        </div>
      </header>

      <div className="stat-strip">
        <div><b>{p.cooks_last_30d}</b><span>people cooked from here this month</span></div>
        <div><b>{p.visits_last_30d}</b><span>check-ins this month</span></div>
        <div><b>{p.item_count}</b><span>items on the shelf</span></div>
      </div>

      <div className="row gap">
        <button className="btn primary" onClick={getDirections} disabled={directionsBusy}>{directionsBusy ? 'Checking the T…' : 'Get transit directions'}</button>
        <button className="btn primary" onClick={visit}>I'm here — check in <small>+10</small></button>
        <button className="btn" onClick={() => setRating(true)}>Rate <small>+5</small></button>
        <button className="btn" onClick={() => setStock(true)}>Report stock <small>+5</small></button>
      </div>
      <p className="muted small privacy-note">Your device location is requested only when you ask for directions and is not saved. SaverMeal sends MBTA only a rounded area for nearby-stop lookup; the external route planner receives no origin from us.</p>

      {(directions || directionsError) && (
        <section className="transit-card" aria-live="polite">
          <header>
            <div>
              <h2>{directions?.live ? 'Live MBTA options' : 'Transit directions'}</h2>
              {directions && <p className="muted small">Updated {new Date(directions.generated_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · location discarded after request</p>}
            </div>
            <a className="btn small primary" href={directions?.directions_url ?? fallbackDirections} target="_blank" rel="noreferrer">Open full route ↗</a>
          </header>
          {directionsError && <p className="error">{directionsError} You can still open directions without sharing your origin with SaverMeal.</p>}
          {directions && directions.origin_stops.length > 0 && (
            <div className="transit-stops">
              <div><strong>Board near you</strong><span>{directions.origin_stops.slice(0, 2).map((s) => `${s.name} (${Math.round(s.distance_m)} m)`).join(' · ')}</span></div>
              {directions.destination_stops.length > 0 && <div><strong>Get off near the pantry</strong><span>{directions.destination_stops.slice(0, 2).map((s) => `${s.name} (${Math.round(s.distance_m)} m)`).join(' · ')}</span></div>}
            </div>
          )}
          {directions && directions.predictions.length > 0 && (
            <ul className="transit-predictions">
              {directions.predictions.slice(0, 5).map((prediction) => (
                <li key={prediction.id}>
                  <i style={{ background: `#${prediction.route.color || '165c35'}`, color: `#${prediction.route.text_color || 'ffffff'}` }}>{prediction.route.short_name || prediction.route.name}</i>
                  <span><strong>{prediction.route.name}</strong><small>{prediction.status}</small></span>
                  <b>{prediction.minutes == null ? '—' : prediction.minutes <= 0 ? 'Now' : `${prediction.minutes} min`}</b>
                </li>
              ))}
            </ul>
          )}
          {directions && directions.alerts.length > 0 && <p className="transit-alert"><strong>Service alert:</strong> {directions.alerts[0].header}</p>}
          {directions?.warnings.map((warning) => <p key={warning} className="muted small">{warning}</p>)}
        </section>
      )}

      <section className="block">
        <h2>Hours & how it works</h2>
        {hasVerifiedHours(p) ? (
          <ul className="hours">
            {Object.entries(p.hours).map(([d, h]) => <li key={d} className={d === today || d === 'Daily' ? 'today' : ''}><span>{d}</span><span>{h}</span></li>)}
          </ul>
        ) : <p className="call-ahead"><strong>Hours have not been verified.</strong> Call the pantry before traveling.</p>}
        {p.phone && <p><strong>Phone:</strong> <a href={`tel:${p.phone}`}>{p.phone}</a></p>}
        <p><strong>Distribution:</strong> {MODEL_LABEL[p.distribution_model]}</p>
        <div className="chips static">{p.features.map((f) => <span key={f} className="chip">{f}</span>)}</div>
        {p.source_url && <p className="small">Source: {p.source_name ? `${p.source_name} · ` : ''}<a href={p.source_url} target="_blank" rel="noreferrer">View listing ↗</a></p>}
      </section>

      <section className="block">
        <h2>On the shelf <span className="muted small">updated {ago(p.last_updated)}</span></h2>
        {(p.inventory_status === 'demo' || p.inventory_status === 'mixed') && <p className="demo-inventory-note">Some or all inventory values are prototype data for demonstration — call ahead; availability is not guaranteed.</p>}
        <div className="shelf">
          {Object.entries(byCat).map(([cat, items]) => (
            <div key={cat}>
              <h3>{cat}</h3>
              <ul>{items.map((i) => <li key={i.name}><span>{i.name}</span><StockBar level={i.level} /><small>{LEVEL_LABEL[i.level]}</small></li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      <section className="block ai">
        <h2>What can I cook with this?</h2>
        <p className="muted small">{gemini ? 'Powered by Gemini, using what this pantry has right now.' : mode === 'demo' ? 'Demo mode: rule-based ideas. Connect the backend with a Gemini key for AI suggestions.' : 'Add GEMINI_API_KEY on the backend for AI suggestions; showing rule-based ideas for now.'}</p>
        <Chips options={DIETS.slice(0, 4)} value={diet} onChange={setDiet} multi />
        <div className="row gap">
          <select value={culture} onChange={(e) => setCulture(e.target.value)} aria-label="Preferred cuisine">
            <option value="">Any cuisine</option>
            {CULTURES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className="btn primary" onClick={suggest} disabled={loading}>{loading ? 'Thinking…' : 'Suggest meals'}</button>
        </div>
        {sug && (
          <div className="meals">
            {sug.meals.length ? sug.meals.map((m) => (
              <article key={m.title} className="meal">
                <header><strong>{m.title}</strong><span className="muted small">{m.culture} · {m.minutes} min</span></header>
                <p>{m.how}</p>
                <p className="small"><span className="have">Have: {m.uses.join(', ')}</span>{m.missing.length > 0 && <><br /><span className="miss">Bring/skip: {m.missing.join(', ')}</span></>}</p>
                {m.substitutions.length > 0 && <p className="small muted">{m.substitutions.join(' ')}</p>}
                <button className="btn small" onClick={() => setShare(fromMeal(m))}>I made this — share it</button>
              </article>
            )) : <p className="empty">No good matches with these filters. Try fewer dietary tags.</p>}
          </div>
        )}
      </section>

      <section className="block">
        <h2>Community recipes from here</h2>
        {p.recipes.length ? (
          <ul className="mini-recipes">
            {p.recipes.map((r) => <li key={r.id}><strong>{r.title}</strong><span className="muted small">by {r.author.name} · {r.taste ? `taste ${r.taste} · ease ${r.ease}` : 'not rated yet'}</span></li>)}
          </ul>
        ) : <p className="empty">No recipes yet. Be the first to share one.</p>}
        <button className="btn" onClick={() => setShare({ pantry_id: p.id })}>Share a recipe from this pantry</button>
      </section>

      {rating && <RatePantry id={p.id} onDone={() => { setRating(false); load(); reloadPantries() }} />}
      {stock && <ReportStock p={p} onDone={() => { setStock(false); load(); reloadPantries() }} />}
      {share && <ShareRecipe initial={share} onClose={() => setShare(null)} onShared={() => { setShare(null); load(); onRecipeShared() }} />}
    </div>
  )
}

function RatePantry({ id, onDone }: { id: number; onDone: () => void }) {
  const { api, celebrate } = useApp()
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  return (
    <Modal title="Rate this pantry" onClose={onDone}>
      <form className="form" onSubmit={async (e) => { e.preventDefault(); celebrate(await api.ratePantry(id, stars, comment), 'Thanks for rating'); onDone() }}>
        <Stars value={stars} onChange={setStars} label="Your rating" />
        <label>Anything others should know? <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Short line, friendly volunteers, bring your own bag…" /></label>
        <button className="btn primary" disabled={!stars}>Submit rating</button>
      </form>
    </Modal>
  )
}

function ReportStock({ p, onDone }: { p: PantryDetail; onDone: () => void }) {
  const { api, celebrate } = useApp()
  const [levels, setLevels] = useState<Record<string, string>>(Object.fromEntries(p.items.map((i) => [i.name, i.level])))
  const [extra, setExtra] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const items = p.items.filter((i) => levels[i.name] !== i.level).map((i) => ({ name: i.name, category: i.category, level: levels[i.name] }))
    extra.split(',').map((s) => s.trim()).filter(Boolean).forEach((name) => items.push({ name, category: 'other', level: 'medium' }))
    const r = await api.updateInventory(p.id, items.length ? items : p.items.map((i) => ({ name: i.name, category: i.category, level: i.level })))
    celebrate(r, r.alerts_triggered ? `Stock updated · ${r.alerts_triggered} alert${r.alerts_triggered > 1 ? 's' : ''} sent` : 'Stock updated')
    onDone()
  }
  return (
    <Modal title={`What's on the shelf at ${p.name}?`} onClose={onDone}>
      <form className="form" onSubmit={submit}>
        <div className="stock-grid">
          {p.items.map((i) => (
            <label key={i.name}><span>{i.name}</span>
              <select value={levels[i.name]} onChange={(e) => setLevels({ ...levels, [i.name]: e.target.value })}>
                {['out', 'low', 'medium', 'high'].map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
              </select>
            </label>
          ))}
        </div>
        <label>New items you saw (comma separated) <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="eggs, bell peppers" /></label>
        <button className="btn primary">Save stock report</button>
      </form>
    </Modal>
  )
}

function SubmitPantry() {
  const { api, loc, toast } = useApp()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', address: '', neighborhood: '', distribution_model: 'client-choice', features: '' })
  return (
    <>
      <button className="btn ghost wide" onClick={() => setOpen(true)}>Know a pantry that's missing? Submit it <small>+30 when verified</small></button>
      {open && (
        <Modal title="Submit a pantry" onClose={() => setOpen(false)}>
          <form className="form" onSubmit={async (e) => {
            e.preventDefault()
            const r = await api.submitPantry({ ...f, lat: loc[0], lng: loc[1], hours: {}, features: f.features.split(',').map((s) => s.trim()).filter(Boolean) })
            toast(r.message)
            setOpen(false)
          }}>
            <label>Name <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label>Address <input required value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
            <label>Neighborhood <input required value={f.neighborhood} onChange={(e) => setF({ ...f, neighborhood: e.target.value })} /></label>
            <label>How it works
              <select value={f.distribution_model} onChange={(e) => setF({ ...f, distribution_model: e.target.value })}>
                {Object.entries(MODEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Features (comma separated) <input value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} placeholder="Fresh produce, No ID required" /></label>
            <p className="muted small">The pin uses your current map location. A volunteer verifies it before it appears.</p>
            <button className="btn primary">Submit for review</button>
          </form>
        </Modal>
      )}
    </>
  )
}
