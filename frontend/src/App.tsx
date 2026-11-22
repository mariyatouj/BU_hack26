import { useCallback, useEffect, useRef, useState } from 'react'
import logo from './assets/icons/cornucopia.png?inline'
import exploreIcon from './assets/icons/map.png?inline'
import cookingIcon from './assets/icons/people.png?inline'
import walletIcon from './assets/icons/TRAIN.png?inline'
import helpIcon from './assets/icons/alert.png?inline'
import historical from '../../data/seed.json'
import { bostonTime, sites } from './routes/catalog'
import { balance, defaults, initialState, type Search } from './routes/domain'
import { commit, listen } from './routes/store'
import { RoutesContext, type Write } from './routes/context'
import Explore from './routes/Explore'
import { Cooking, Staff, Wallet } from './routes/Activity'
import './routes/routes.css'

const pages = {
  explore: { label: 'Explore', icon: exploreIcon },
  cooking: { label: 'Cooking', icon: cookingIcon },
  wallet: { label: 'Wallet', icon: walletIcon },
  help: { label: 'Access help', icon: helpIcon },
  staff: { label: 'Pantry editor', icon: null },
}
type Page = keyof typeof pages
const pageFromHash = (): Page => {
  const name = location.hash.slice(1).split('/')[0]
  return Object.hasOwn(pages, name) ? (name as Page) : 'explore'
}
function linkedFilter() {
  const [page, id] = location.hash.slice(1).split('/')
  return page === 'explore' && sites.some((s) => s.id === id)
    ? { ...defaults, scope: 'pantry' as const, pantryId: id }
    : defaults
}
function AccessHelp() {
  return (
    <>
      <header className="page-intro">
        <h1>Access help</h1>
        <p>Food, transit and cultural access information is open to everyone.</p>
      </header>
      <section className="panel resource-card">
        <h2>Find food today</h2>
        <p>
          Explore uses fictional pantry sites and synthetic stock. For an actual pickup, confirm hours,
          eligibility, service area, appointment requirements and access with the pantry.
        </p>
        <div className="resource-action">
          <a className="btn primary" href="https://www.gbfb.org/need-food/" target="_blank" rel="noreferrer">
            Find a participating food pantry through GBFB ↗
          </a>
        </div>
        <details className="historical-details">
          <summary>Historical Boston directory and contacts</summary>
          <p className="small muted">City of Boston GIS / GBFB, September 2021. Call ahead to confirm the listing.</p>
          <div className="directory-list">
            {historical.pantries.map((p) => (
              <p key={p.id} className="directory-item">
                <b>{p.name}</b> · {p.address} · <a href={'tel:' + p.phone}>{p.phone}</a> ·{' '}
                <a href={p.source_url} target="_blank" rel="noreferrer">Directory source</a>
              </p>
            ))}
          </div>
        </details>
      </section>
      <section className="panel resource-card">
        <h2>Help with the first trip</h2>
        <p>
          Check existing reduced-fare programs and eligibility before traveling. You can access these
          resources without cooking or collecting points.
        </p>
        <a className="resource-link" href="https://www.mbta.com/fares/reduced" target="_blank" rel="noreferrer">
          MBTA reduced fares ↗
        </a>
      </section>
      <section className="panel resource-card">
        <h2>Museums and shows</h2>
        <p>
          Check each venue for eligibility, ticket coverage and reservations. Exhibit admission and show
          tickets can have different conditions.
        </p>
        <ul className="venue-list">
          <li>
            <a href="https://www.mos.org/visit/community-access" target="_blank" rel="noreferrer">Museum of Science community access</a>
          </li>
          <li>
            <a href="https://www.neaq.org/visit/offers-and-discounts/" target="_blank" rel="noreferrer">New England Aquarium discounts</a>
          </li>
          <li>
            <a href="https://www.mfa.org/visit/free-and-discounted-admission" target="_blank" rel="noreferrer">
              MFA free and discounted admission
            </a>
          </li>
        </ul>
      </section>
      <section className="panel resource-card">
        <h2>Why pantry access matters</h2>
        <p>
          GBFB’s 2026 Massachusetts Food Access Report estimates that 40% of Massachusetts households
          experienced food insecurity in 2025. SaverMeal demonstrates how reachable pantry sessions can
          connect people with meal ideas.
        </p>
        <a className="resource-link" href="https://foodaccessreport.gbfb.org/the-state-of-food-insecurity" target="_blank" rel="noreferrer">
          GBFB and Mass General Brigham report ↗
        </a>
      </section>
    </>
  )
}
export default function App() {
  const [page, setPage] = useState(pageFromHash),
    [state, setState] = useState(initialState),
    [ready, setReady] = useState(false)
  const [filter, setFilter] = useState<Search>(linkedFilter),
    [message, setMessage] = useState('')
  const readVersion = useRef(0)
  const refresh = useCallback(async () => {
    const n = ++readVersion.current
    try {
      const data = await commit()
      if (n === readVersion.current) {
        setState(data)
        setReady(true)
      }
    } catch {
      setReady(false)
      setMessage('Browser storage is unavailable. Explore is available. Enable storage to save changes.')
    }
  }, [])
  useEffect(() => {
    void refresh()
    return listen(refresh)
  }, [refresh])
  useEffect(() => {
    const update = () => {
      setPage(pageFromHash())
      if (location.hash.startsWith('#explore/')) setFilter(linkedFilter())
      setMessage('')
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  const write: Write = async (fn, msg) => {
    if (!ready) {
      setMessage('Persistent browser storage is required to save this action.')
      return false
    }
    try {
      const next = await commit(fn, state.generation)
      readVersion.current++
      setState(next)
      if (msg) setMessage(msg)
      return true
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'The change could not be saved.')
      void refresh()
      return false
    }
  }
  const generation = useRef('')
  useEffect(() => {
    if (ready && generation.current && generation.current !== state.generation) setFilter(defaults)
    if (ready) generation.current = state.generation
  }, [ready, state.generation])
  return (
    <RoutesContext.Provider value={{ state, write, notify: setMessage }}>
      <div className="routes-shell">
        <a
          href="#workspace"
          className="skip"
          onClick={(e) => {
            e.preventDefault()
            document.getElementById('workspace')?.focus()
          }}
        >
          Skip to content
        </a>
        <header className="mast">
          <a href="#explore" className="brand">
            <img src={logo} width="42" height="42" alt="" />
            <span>
              SaverMeal<small>Boston</small>
            </span>
          </a>
          <nav aria-label="Main navigation">
            {(Object.keys(pages) as Page[]).map((k) => (
              <a
                key={k}
                className={k === 'staff' ? 'staff-link' : undefined}
                aria-current={page === k ? 'page' : undefined}
                href={'#' + k}
              >
                {pages[k].icon && <img src={pages[k].icon} width="29" height="29" alt="" />}
                {pages[k].label}
              </a>
            ))}
          </nav>
          <a className="balance-pill" href="#wallet">
            {balance(state)} pts
          </a>
        </header>
        <div className="simtime">
          <span>
            <strong>Demo</strong> · Fictional pantry sessions
          </span>
          <span className="demo-clock">Simulated {bostonTime(state.clock)} ET</span>
          <a href="#help" className="real-help-link">
            Find real food assistance <span aria-hidden="true">↗</span>
          </a>
        </div>
        {message && (
          <div className="feedback" role="status">
            <span>{message}</span>
            <button aria-label="Dismiss message" onClick={() => setMessage('')}>
              ×
            </button>
          </div>
        )}
        <main
          id="workspace"
          className={page === 'explore' ? undefined : 'workspace-inner'}
          tabIndex={-1}
          key={state.generation}
        >
          {page === 'explore' ? (
            <Explore f={filter} setF={setFilter} />
          ) : page === 'cooking' ? (
            <Cooking />
          ) : page === 'wallet' ? (
            <Wallet />
          ) : page === 'staff' ? (
            <Staff />
          ) : (
            <AccessHelp />
          )}
        </main>
      </div>
    </RoutesContext.Provider>
  )
}
