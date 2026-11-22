import { rules } from './catalog'
import { useEffect, useRef, useState } from 'react'
import {
  bostonDay,
  bostonTime,
  caps,
  availability,
  ingredients,
  label,
  recipes,
  rewards,
  rewardNotice,
  sites,
  type Capacity,
} from './catalog'
import {
  awardMeal,
  balance,
  cancel,
  editSnapshot,
  initialState,
  latest,
  minutesLater,
  remaining,
  reserve,
  status,
  type Edit,
  type Save,
} from './domain'
import { useRoutes } from './context'
import { Checks } from './Explore'
import { getPhoto, preparePhoto } from './store'
import sample from '../assets/demo/lentil-dal.jpg'

function PrivatePhoto({ id }: { id: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let active = true,
      src = ''
    getPhoto(id)
      .then((blob) => {
        if (active && blob) {
          src = URL.createObjectURL(blob)
          setUrl(src)
        }
      })
      .catch(() => {})
    return () => {
      active = false
      if (src) URL.revokeObjectURL(src)
    }
  }, [id])
  return url ? <img className="meal-photo" alt="Private cooking submission" src={url} /> : null
}
function CookingForm({ save }: { save: Save }) {
  const { state, write, notify } = useRoutes()
  const [selected, setSelected] = useState<string[]>([]),
    [photo, setPhoto] = useState<Awaited<ReturnType<typeof preparePhoto>> | null>(null)
  const [preview, setPreview] = useState(''),
    [busy, setBusy] = useState(false),
    [date, setDate] = useState(bostonDay(state.clock))
  const attempt = useRef(crypto.randomUUID()),
    photoVersion = useRef(0)
  useEffect(() => {
    if (!photo) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(photo.blob)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])
  async function load(file: Blob) {
    const v = ++photoVersion.current
    setBusy(true)
    setPhoto(null)
    try {
      const processed = await preparePhoto(file)
      if (v === photoVersion.current) setPhoto(processed)
    } catch (e) {
      notify((e as Error).message)
    } finally {
      if (v === photoVersion.current) setBusy(false)
    }
  }
  async function submit() {
    if (!photo) return
    const id = attempt.current
    setBusy(true)
    const ok = await write((s, photos) => {
      if (!awardMeal(s, id, save.id, selected, date, photo.hash)) return
      if (s.meals.filter((m) => m.photoId).length > rules.maximumPhotos)
        throw Error('Photo storage is full. Delete a stored photo first.')
      photos.put(photo.blob, id)
    }, 'Demo accepted · 100 points earned. The meal is private.')
    if (ok) {
      setSelected([])
      setPhoto(null)
      attempt.current = crypto.randomUUID()
    }
    setBusy(false)
  }
  return (
    <div className="panel">
      <h2>Record a cooked meal</h2>
      <p>
        {sites.find((s) => s.id === save.pantryId)?.name} · pickup saved {bostonTime(save.savedAt)} ET
      </p>
      <Checks
        legend="I received and used these ingredients from this pantry"
        values={save.received}
        selected={selected}
        change={setSelected}
        format={label}
      />
      <label>
        Cooking date
        <input
          type="date"
          value={date}
          min={bostonDay(save.savedAt)}
          max={bostonDay(state.clock)}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <label>
        Meal photo
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void load(file)
            e.target.value = ''
          }}
        />
      </label>
      <div className="row">
        <button
          className="btn small"
          disabled={busy}
          onClick={async () => {
            try {
              await load(await (await fetch(sample)).blob())
            } catch {
              notify('The rehearsal image could not be opened.')
            }
          }}
        >
          Use AI-generated rehearsal photo
        </button>
        {photo && (
          <button className="btn small" onClick={() => setPhoto(null)}>
            Remove selected photo
          </button>
        )}
      </div>
      {preview && <img className="meal-photo" src={preview} alt="Selected meal" />}
      <p>
        {new Set(selected.map((k) => k.split('@')[0])).size} distinct ingredients confirmed ·{' '}
        {photo ? 'Photo ready' : 'Photo required'} · Private in this browser
      </p>
      <button
        className="btn primary"
        disabled={busy || !photo || new Set(selected.map((k) => k.split('@')[0])).size < 3}
        onClick={submit}
      >
        Submit private meal
      </button>
    </div>
  )
}
function SavedRecipe({ save }: { save: Save }) {
  const { state, write } = useRoutes()
  const [selected, setSelected] = useState<string[]>([])
  const s = state.snapshots.find((s) => s.id === save.snapshotId)!
  const available = s.items
    .filter((i) => ['available', 'limited'].includes(status(i, s, save.savedAt)))
    .map((i) => i.key)
  return (
    <details>
      <summary>
        {recipes.find((r) => r.id === save.recipeId)?.title} · {sites.find((p) => p.id === s.pantryId)?.name}
      </summary>
      <p>Saved {bostonTime(save.savedAt)} ET · Demo inventory at pickup</p>
      <Checks
        legend="Items actually received from this saved shelf"
        values={available}
        selected={selected}
        change={setSelected}
        format={label}
      />
      <button
        className="btn"
        disabled={!selected.length}
        onClick={() =>
          write((st) => {
            const existing = st.saves.find((p) => p.id === save.id)
            if (!existing || existing.received.length) throw Error('This pickup already changed.')
            existing.received = selected
          }, 'Pickup recorded.')
        }
      >
        Confirm pickup
      </button>
    </details>
  )
}
export function Cooking() {
  const { state, write } = useRoutes(),
    [id, setId] = useState('')
  const pickups = state.saves.filter((s) => s.received.length).toReversed(),
    saved = state.saves.filter((s) => !s.received.length)
  const chosen = pickups.find((p) => p.id === id) ?? pickups[0]
  return (
    <>
      <header className="page-intro">
        <h1>Cooking journal</h1>
        <p>
          Your saved pickups, meals and photos stay in this browser. Each accepted meal earns 100 points, up
          to three awards in seven days.
        </p>
      </header>
      {saved.length > 0 && (
        <section className="panel">
          <h2>Saved recipes</h2>
          {saved.map((s) => (
            <SavedRecipe save={s} key={s.id} />
          ))}
        </section>
      )}
      {chosen ? (
        <>
          <label>
            Saved pickup
            <select value={chosen.id} onChange={(e) => setId(e.target.value)}>
              {pickups.map((p) => (
                <option key={p.id} value={p.id}>
                  {recipes.find((r) => r.id === p.recipeId)?.title} ·{' '}
                  {sites.find((s) => s.id === p.pantryId)?.name} · {bostonTime(p.savedAt)}
                </option>
              ))}
            </select>
          </label>
          <CookingForm key={chosen.id} save={chosen} />
        </>
      ) : (
        <p className="empty">
          Open a recipe in <a href="#explore">Explore</a> and record what you received to start cooking.
        </p>
      )}
      <h2 className="section-title">Accepted meals</h2>
      {!state.meals.length && <p>No meals recorded yet.</p>}
      {state.meals.toReversed().map((m) => (
        <article className="panel" key={m.id}>
          <h3>{recipes.find((r) => r.id === m.recipeId)?.title}</h3>
          <p>
            {m.status} · {m.cookedAt} · {m.ingredientIds.join(', ')} · Private
          </p>
          {m.photoId && (
            <>
              <PrivatePhoto id={m.photoId} />
              <button
                className="btn small"
                onClick={() =>
                  write((s, photos) => {
                    const meal = s.meals.find((x) => x.id === m.id)
                    if (meal) {
                      photos.delete(m.id)
                      meal.photoId = null
                    }
                  }, 'Photo deleted from this browser.')
                }
              >
                Delete stored photo
              </button>
            </>
          )}
        </article>
      ))}
    </>
  )
}
export function Wallet() {
  const { state, write } = useRoutes()
  const [confirm, setConfirm] = useState<{ id: string; reward: string } | null>(null),
    [busy, setBusy] = useState(false)
  return (
    <>
      <header className="page-intro">
        <h1>Private wallet</h1>
        <p>Cooking awards and simulated sponsor-funded reservations.</p>
      </header>
      <div className="wallet-total">
        <span>Available balance</span>
        <strong>
          {balance(state)} <small>demo points</small>
        </strong>
      </div>
      <h2 className="section-title">Rewards</h2>
      <div className="reward-grid">
        {rewards.map((r) => (
          <article className="panel" key={r.id}>
            <h3>{r.title}</h3>
            <p>{r.coverage}</p>
            <p>
              {r.cost} points · {remaining(state, r.id)} demo units
            </p>
            <small>
              {r.sponsorStatus} · {r.fulfillmentType} · claim by {bostonTime(r.expiresAt)} ET
            </small>
            <button
              className="btn"
              disabled={
                balance(state) < r.cost || remaining(state, r.id) < 1 || state.clock >= r.expiresAt || busy
              }
              onClick={() => setConfirm({ reward: r.id, id: crypto.randomUUID() })}
            >
              Reserve {r.title}
            </button>
          </article>
        ))}
      </div>
      {confirm && (
        <div className="panel" role="region" aria-label="Confirm reservation">
          <h3>Confirm {rewards.find((r) => r.id === confirm.reward)?.title}</h3>
          <p>{rewardNotice}</p>
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const ok = await write((s) => reserve(s, confirm.reward, confirm.id), rewardNotice)
              setBusy(false)
              if (ok) setConfirm(null)
            }}
          >
            Confirm reservation
          </button>
          <button className="btn" disabled={busy} onClick={() => setConfirm(null)}>
            Back
          </button>
        </div>
      )}
      <h2 className="section-title">Reservations</h2>
      {!state.claims.length && <p>No reservations yet.</p>}
      {state.claims.toReversed().map((c) => (
        <article className="panel" key={c.id}>
          <b>
            {rewards.find((r) => r.id === c.rewardId)?.title} · {c.status}
          </b>
          <p>{rewardNotice}</p>
          <small>Reference {c.id}</small>
          {c.status === 'reserved' && (
            <button
              className="btn"
              onClick={() =>
                write((s) => cancel(s, c.id), 'Reservation canceled. Points and stock restored.')
              }
            >
              Cancel reservation
            </button>
          )}
        </article>
      ))}
      <h2 className="section-title">Points history</h2>
      <ul className="ledger">
        {state.ledger.toReversed().map((e) => (
          <li key={e.id}>
            <span>
              {e.reason} <small>{bostonTime(e.at)} ET</small>
            </span>
            <b>
              {e.amount > 0 ? '+' : ''}
              {e.amount}
            </b>
          </li>
        ))}
      </ul>
    </>
  )
}
function Editor({ id }: { id: string }) {
  const { state, write } = useRoutes(),
    snap = latest(state, id)
  const [capacity, setCapacity] = useState<Capacity>(snap.capacity)
  const [items, setItems] = useState<Edit[]>(
    snap.items.map((i) => ({ key: i.key, state: i.state, surplus: i.surplus })),
  )
  const [extra, setExtra] = useState('')
  const edit = (key: string, patch: Partial<Edit>) =>
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const changed =
    capacity !== snap.capacity ||
    items.some(
      (r, i) =>
        !snap.items[i] || r.state !== snap.items[i].state || r.surplus !== snap.items[i].surplus || r.renew,
    )
  return (
    <section className="panel">
      <h2>Session stock</h2>
      <p>
        Demo inventory · {bostonTime(snap.startsAt)} – {bostonTime(snap.endsAt)} ET. Edited items expire after
        60 minutes or at session end.
      </p>
      <label>
        Capacity
        <select value={capacity} onChange={(e) => setCapacity(e.target.value as Capacity)}>
          {caps.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      {items.map((row) => (
        <div className="stock-edit" key={row.key}>
          <label>
            {label(row.key)}
            <select
              aria-label={label(row.key)}
              value={row.state}
              onChange={(e) => edit(row.key, { state: e.target.value as Edit['state'] })}
            >
              {availability.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={row.surplus}
              onChange={(e) => edit(row.key, { surplus: e.target.checked })}
            />{' '}
            Surplus
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!row.renew}
              onChange={(e) => edit(row.key, { renew: e.target.checked })}
            />{' '}
            Re-observed now
          </label>
        </div>
      ))}
      <div className="origin">
        <label>
          Add item
          <select value={extra} onChange={(e) => setExtra(e.target.value)}>
            <option value="">Select an ingredient</option>
            {ingredients
              .filter((k) => !items.some((r) => r.key === k))
              .map((k) => (
                <option key={k} value={k}>
                  {label(k)}
                </option>
              ))}
          </select>
        </label>
        <button
          className="btn"
          disabled={!extra}
          onClick={() => {
            setItems((v) => [...v, { key: extra, state: 'available', surplus: false }])
            setExtra('')
          }}
        >
          Add
        </button>
      </div>
      <button
        className="btn primary"
        disabled={!changed}
        onClick={() =>
          write((s) => {
            editSnapshot(s, id, snap.id, capacity, items)
          }, 'Session updated. Explore now uses the new snapshot.')
        }
      >
        Save session changes
      </button>
    </section>
  )
}
export function Staff() {
  const { state, write } = useRoutes(),
    [id, setId] = useState(sites[0].id),
    [reset, setReset] = useState(false)
  return (
    <>
      <header className="page-intro">
        <h1>Pantry editor</h1>
        <p>Manage fictional distribution sessions and advance the demonstration clock.</p>
      </header>
      <section className="panel">
        <h2>Simulated time</h2>
        <p>{bostonTime(state.clock)} ET</p>
        <div className="row">
          {[30, 90].map((n) => (
            <button
              key={n}
              className="btn"
              onClick={() =>
                write((s) => {
                  s.clock = minutesLater(s.clock, n)
                }, 'Simulation clock advanced.')
              }
            >
              +{n} minutes
            </button>
          ))}
          <button className="btn" onClick={() => setReset(true)}>
            Reset demo
          </button>
        </div>
        {reset && (
          <p>
            Restore the initial clock, inventory and balance, and delete this browser’s saved meals and
            photos?
            <button className="btn" onClick={() => setReset(false)}>
              Keep data
            </button>
            <button
              className="btn"
              onClick={() =>
                write((s, p) => {
                  Object.assign(s, initialState())
                  p.clear()
                }, 'Scenario restored.')
              }
            >
              Confirm reset
            </button>
          </p>
        )}
      </section>
      <label>
        Pantry to edit
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <Editor key={latest(state, id).id} id={id} />
    </>
  )
}
