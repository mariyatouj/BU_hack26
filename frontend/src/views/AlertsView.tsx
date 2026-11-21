import { useEffect, useState } from 'react'
import BostonMap from '../components/BostonMap'
import { CULTURES, ago } from '../components/ui'
import { useApp } from '../context'
import type { FoodAlert, Notice } from '../types'

export default function AlertsView() {
  const { api, pantries, loc, setLoc, me, toast, go } = useApp()
  const [alerts, setAlerts] = useState<FoodAlert[]>([])
  const [notes, setNotes] = useState<Notice[]>([])
  const [dishes, setDishes] = useState<Record<string, string[]>>({})
  const [dish, setDish] = useState('')
  const [culture, setCulture] = useState('')
  const [radius, setRadius] = useState(3)
  const [custom, setCustom] = useState('')
  const [onIng, setOnIng] = useState(true)
  const [onRecipe, setOnRecipe] = useState(true)
  const [minMatch, setMinMatch] = useState(60)
  const [err, setErr] = useState('')

  const load = () => Promise.all([api.alerts().then(setAlerts), api.notifications().then(setNotes)])
  useEffect(() => { load(); api.dishes().then(setDishes) }, [me.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const known = dishes[dish.toLowerCase().trim()]
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    try {
      const ingredients = custom.split(',').map((s) => s.trim()).filter(Boolean)
      await api.createAlert({
        dish, culture: culture || null, ingredients: ingredients.length ? ingredients : null, lat: loc[0], lng: loc[1],
        radius_km: radius, notify_on: [...(onIng ? ['ingredients' as const] : []), ...(onRecipe ? ['recipe' as const] : [])],
        min_match: minMatch / 100,
      })
      toast(`Alert set for ${dish}`)
      setDish(''); setCustom('')
      load()
    } catch (x) { setErr((x as Error).message) }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Food alerts</h1>
          <p className="muted">Tell us a dish you're craving. We'll ping you when a nearby pantry stocks its ingredients, or a neighbor shares a matching recipe.</p>
        </div>
      </div>
      <div className="alerts-grid">
        <form className="form card" onSubmit={submit}>
          <h2>New alert</h2>
          <label>Dish
            <input required list="dish-list" value={dish} onChange={(e) => setDish(e.target.value)} placeholder="fried rice, dal, chili…" />
            <datalist id="dish-list">{Object.keys(dishes).map((d) => <option key={d} value={d} />)}</datalist>
          </label>
          {known && <p className="small muted">Watching for: {known.join(', ')}</p>}
          <label>Main ingredients {known ? <small className="muted">(optional override)</small> : <small className="muted">(comma separated)</small>}
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="rice, eggs, scallions" required={!known && !!dish} />
          </label>
          <label>Culture (also matches recipes tagged with it)
            <select value={culture} onChange={(e) => setCulture(e.target.value)}>
              <option value="">Any</option>{CULTURES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Search radius: <b>{radius} km</b>
            <input type="range" min={0.5} max={10} step={0.5} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
          </label>
          <fieldset>
            <legend>Ping me when</legend>
            <label className="switch"><input type="checkbox" checked={onIng} onChange={(e) => setOnIng(e.target.checked)} /> A pantry has at least {minMatch}% of the ingredients</label>
            {onIng && <input type="range" min={30} max={100} step={10} value={minMatch} onChange={(e) => setMinMatch(Number(e.target.value))} aria-label="Minimum ingredient match" />}
            <label className="switch"><input type="checkbox" checked={onRecipe} onChange={(e) => setOnRecipe(e.target.checked)} /> Someone shares a matching recipe</label>
          </fieldset>
          {err && <p className="error">{err}</p>}
          <button className="btn primary" disabled={!onIng && !onRecipe}>Create alert</button>
        </form>
        <div className="map-card">
          <BostonMap pantries={pantries} you={loc} onMoveYou={(a, b) => setLoc([a, b])} radiusKm={radius} />
          <p className="muted small">The circle is your search area. Tap the map to move its center.</p>
        </div>
      </div>

      <div className="alerts-grid">
        <section>
          <h2>Your alerts</h2>
          {alerts.map((a) => (
            <article key={a.id} className="alert card">
              <header>
                <div><strong>{a.dish}</strong>{a.culture && <span className="tag">{a.culture}</span>}<p className="muted small">within {a.radius_km} km · {a.notify_on.join(' + ')}</p></div>
                <button className="btn small ghost" onClick={async () => { await api.deleteAlert(a.id); load() }}>Remove</button>
              </header>
              <ul className="matches">
                {a.matches.slice(0, 4).map((m) => (
                  <li key={m.pantry_id}>
                    <button className="link" onClick={() => go('pantries', m.pantry_id)}>{m.pantry_name}</button>
                    <span className="muted small">{m.distance_km.toFixed(1)} km</span>
                    <span className="meter"><i style={{ width: `${m.match * 100}%` }} /></span>
                    <span className="small">{Math.round(m.match * 100)}%</span>
                  </li>
                ))}
                {!a.matches.length && <li className="empty">No pantries in range yet. Try a bigger radius.</li>}
              </ul>
            </article>
          ))}
          {!alerts.length && <p className="empty">No alerts yet.</p>}
        </section>
        <section>
          <h2>Notifications</h2>
          <ul className="notes">
            {notes.map((n) => (
              <li key={n.id} className={n.read ? '' : 'unread'}>
                <span className={`kind ${n.kind}`}>{n.kind === 'recipe' ? 'Recipe' : 'Stock'}</span>
                <span>{n.message}</span>
                <span className="muted small">{ago(n.created_at)}</span>
              </li>
            ))}
            {!notes.length && <li className="empty">Nothing yet. Tip: switch to another user and share a fried-rice recipe, or report stock at a pantry, to see an alert fire.</li>}
          </ul>
        </section>
      </div>
    </div>
  )
}
