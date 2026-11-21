import { useEffect, useState } from 'react'
import { Avatar, Chips, CULTURES, DIETS, Modal, Stars, ago } from '../components/ui'
import { useApp } from '../context'
import type { Recipe } from '../types'
import ShareRecipe from './ShareRecipe'

export default function RecipesView() {
  const { api, me, go } = useApp()
  const [list, setList] = useState<Recipe[]>([])
  const [q, setQ] = useState('')
  const [culture, setCulture] = useState<string[]>([])
  const [diet, setDiet] = useState<string[]>([])
  const [sort, setSort] = useState('top')
  const [open, setOpen] = useState<Recipe | null>(null)
  const [sharing, setSharing] = useState(false)

  const load = () => api.recipes({ q, culture: culture[0], dietary: diet[0], sort }).then(setList)
  useEffect(() => { load() }, [q, culture, diet, sort, me.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Community recipes</h1>
          <p className="muted">Real meals neighbors made from pantry food. Rate them on taste and ease.</p>
        </div>
        <button className="btn primary" onClick={() => setSharing(true)}>Share a dish <small>+20</small></button>
      </div>
      <div className="toolbar">
        <input type="search" placeholder="Search a dish or ingredient (e.g. lentils)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search recipes" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="top">Top rated</option><option value="new">Newest</option><option value="easy">Easiest</option>
        </select>
      </div>
      <div className="toolbar chips-row">
        <Chips options={CULTURES.slice(0, 7)} value={culture} onChange={setCulture} />
        <Chips options={DIETS.slice(0, 4)} value={diet} onChange={setDiet} />
      </div>
      <div className="rgrid">
        {list.map((r) => (
          <article key={r.id} className="rcard" onClick={() => setOpen(r)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(r)}>
            <div className="rimg">{r.image_url ? <img src={r.image_url} alt="" /> : <Plate seed={r.id} />}</div>
            <div className="rbody">
              <div className="tags">{[...r.culture_tags, ...r.dietary_tags].map((t) => <span key={t} className="tag">{t}</span>)}</div>
              <h3>{r.title}</h3>
              <div className="rmeta">
                <span>{r.taste ? <><Stars value={r.score} /> {r.score.toFixed(1)}</> : <span className="muted">New</span>}</span>
                <span className="muted">{r.minutes} min</span>
              </div>
              <p className="muted small">by {r.author.name}{r.pantry ? ` · from ${r.pantry.name}` : ''}</p>
            </div>
          </article>
        ))}
        {!list.length && <p className="empty">No recipes match. Clear a filter or share the first one.</p>}
      </div>
      {open && <RecipeModal r={open} onClose={() => setOpen(null)} onChanged={(r) => { setOpen(r); load() }} onPantry={(id) => go('pantries', id)} />}
      {sharing && <ShareRecipe initial={{}} onClose={() => setSharing(false)} onShared={() => { setSharing(false); load() }} />}
    </div>
  )
}

const PLATE = ['#f4c95d', '#e5482b', '#7bb662', '#f08a4b', '#c9a46b', '#9a6fb0']
function Plate({ seed }: { seed: number }) {
  const c = (i: number) => PLATE[(seed + i) % PLATE.length]
  return (
    <svg viewBox="0 0 200 130" aria-hidden>
      <rect width="200" height="130" fill="var(--plate-bg)" />
      <ellipse cx="100" cy="72" rx="70" ry="44" fill="var(--plate)" />
      <ellipse cx="100" cy="68" rx="54" ry="32" fill="var(--plate-rim)" />
      <circle cx="84" cy="64" r="15" fill={c(0)} /><circle cx="110" cy="58" r="12" fill={c(1)} />
      <circle cx="116" cy="78" r="13" fill={c(2)} /><circle cx="92" cy="82" r="9" fill={c(3)} />
    </svg>
  )
}

function RecipeModal({ r, onClose, onChanged, onPantry }: { r: Recipe; onClose: () => void; onChanged: (r: Recipe) => void; onPantry: (id: number) => void }) {
  const { api, me, celebrate, users } = useApp()
  const [taste, setTaste] = useState(0)
  const [ease, setEase] = useState(0)
  const [err, setErr] = useState('')
  const mine = r.author.id === me.id
  const author = users.find((u) => u.id === r.author.id)
  const rate = async () => {
    try {
      const res = await api.rateRecipe(r.id, taste, ease)
      celebrate(res, res.points_earned ? 'Rating saved' : 'Rating updated')
      onChanged(res.recipe)
    } catch (x) { setErr((x as Error).message) }
  }
  return (
    <Modal title={r.title} onClose={onClose} wide>
      <div className="recipe">
        <div>
          {r.image_url && <img className="recipe-img" src={r.image_url} alt={r.title} />}
          <p className="byline"><Avatar name={r.author.name} line={author?.t_line} size={28} /> {r.author.name}{r.author.university ? `, ${r.author.university}` : ''} · {ago(r.created_at)}</p>
          {r.description && <p>{r.description}</p>}
          {r.pantry && <p className="small">Food from <button className="link" onClick={() => onPantry(r.pantry!.id)}>{r.pantry.name}</button></p>}
          <div className="tags">{[...r.culture_tags, ...r.dietary_tags].map((t) => <span key={t} className="tag">{t}</span>)}</div>
          <h3>Ingredients</h3>
          <ul>{r.ingredients.map((i) => <li key={i}>{i}</li>)}</ul>
          {r.steps.length > 0 && <><h3>Steps</h3><ol>{r.steps.map((s) => <li key={s}>{s}</li>)}</ol></>}
        </div>
        <aside className="rate-box">
          <h3>Community score</h3>
          <dl>
            <div><dt>Taste</dt><dd>{r.taste ?? '–'}</dd></div>
            <div><dt>Ease</dt><dd>{r.ease ?? '–'}</dd></div>
            <div><dt>Ratings</dt><dd>{r.rating_count}</dd></div>
          </dl>
          {mine ? <p className="muted small">This is your recipe — others will rate it.</p> : (
            <>
              <h3>Your rating <small className="muted">+5</small></h3>
              <label>Taste <Stars value={taste} onChange={setTaste} label="Taste rating" /></label>
              <label>Ease of preparation <Stars value={ease} onChange={setEase} label="Ease rating" /></label>
              <button className="btn primary" disabled={!taste || !ease} onClick={rate}>Submit rating</button>
              {err && <p className="error">{err}</p>}
            </>
          )}
        </aside>
      </div>
    </Modal>
  )
}
