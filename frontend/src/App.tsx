import { useCallback, useEffect, useMemo, useState } from 'react'
import { connect, type Api } from './api'
import { Avatar } from './components/ui'
import { AppCtx, type Ctx, type View } from './context'
import { setUserId } from './session'
import type { Earned, Me, Pantry, User } from './types'
import AlertsView from './views/AlertsView'
import LeaderboardView from './views/LeaderboardView'
import MeView from './views/MeView'
import PantriesView from './views/PantriesView'
import RecipesView from './views/RecipesView'

const VIEWS: { id: View; label: string }[] = [
  { id: 'pantries', label: 'Pantries' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'me', label: 'My points' },
]
const BU: [number, number] = [42.3505, -71.1054]
const fromHash = (): View => (VIEWS.find((v) => `#${v.id}` === location.hash)?.id ?? 'pantries')

function Logo() {
  return (
    <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden>
      <circle cx="20" cy="20" r="20" fill="var(--brand)" />
      <path d="M9 19h22a11 11 0 0 1-22 0z" fill="#fff" />
      <path d="M15 15c0-3 3-3 3-6M21 15c0-3 3-3 3-6" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="20" cy="24" r="2.6" fill="var(--accent)" />
    </svg>
  )
}

export default function App() {
  const [conn, setConn] = useState<{ api: Api; mode: 'live' | 'demo'; gemini: boolean } | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [pantries, setPantries] = useState<Pantry[]>([])
  const [view, setView] = useState<View>(fromHash())
  const [focusPantry, setFocusPantry] = useState<number | null>(null)
  const [loc, setLoc] = useState<[number, number]>(BU)
  const [toasts, setToasts] = useState<{ id: number; msg: string; pts?: number }[]>([])
  const [unread, setUnread] = useState(0)

  useEffect(() => { connect().then(setConn) }, [])
  useEffect(() => {
    const h = () => setView(fromHash())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  const refreshMe = useCallback(async () => {
    if (!conn) return
    const [m, n] = await Promise.all([conn.api.me(), conn.api.notifications()])
    setMe(m)
    setUnread(n.filter((x) => !x.read).length)
  }, [conn])
  const reloadPantries = useCallback(async () => { if (conn) setPantries(await conn.api.pantries(loc[0], loc[1])) }, [conn, loc])

  useEffect(() => { if (conn) { conn.api.users().then(setUsers); refreshMe() } }, [conn, refreshMe])
  useEffect(() => { reloadPantries() }, [reloadPantries])

  const push = (msg: string, pts?: number) => {
    const id = Math.random()
    setToasts((t) => [...t, { id, msg, pts }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
  }
  const celebrate = (e: Earned, what: string) => { push(what, e.points_earned || undefined); refreshMe() }
  const go = (v: View, pantryId?: number) => {
    if (pantryId) setFocusPantry(pantryId)
    location.hash = v
    setView(v)
  }
  const switchUser = (id: number) => { setUserId(id); refreshMe(); conn?.api.users().then(setUsers) }

  const ctx = useMemo<Ctx | null>(() => conn && me ? {
    api: conn.api, mode: conn.mode, gemini: conn.gemini, me, users, refreshMe, toast: (m) => push(m), celebrate,
    loc, setLoc, pantries, reloadPantries, go, focusPantry,
  } : null, [conn, me, users, loc, pantries, focusPantry]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ctx) return <div className="boot"><Logo /><p>Loading Pantry Pass…</p></div>

  return (
    <AppCtx.Provider value={ctx}>
      <header className="top">
        <a className="brand" href="#pantries" onClick={() => setFocusPantry(null)}><Logo /><span>Pantry Pass<small>Boston</small></span></a>
        <nav className="scroll" aria-label="Main">
          {VIEWS.map((v) => (
            <a key={v.id} href={`#${v.id}`} className={view === v.id ? 'on' : ''} aria-current={view === v.id ? 'page' : undefined}
              onClick={() => v.id === 'pantries' && setFocusPantry(null)}>
              {v.label}{v.id === 'alerts' && unread > 0 && <span className="count">{unread}</span>}
            </a>
          ))}
        </nav>
        <div className="who-am-i">
          <a className="pts-pill" href="#me" title="Your points"><b>{me!.points}</b> pts</a>
          <label className="user-switch">
            <Avatar name={me!.name} line={me!.t_line} size={30} />
            <select value={me!.id} onChange={(e) => switchUser(Number(e.target.value))} aria-label="Signed in as (demo)">
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
        </div>
      </header>
      {conn!.mode === 'demo' && <p className="demo-note">Demo mode with sample pantries and users — data resets on reload. Run the FastAPI backend for live data.</p>}
      <main>
        {view === 'pantries' && <PantriesView key={focusPantry ?? 0} />}
        {view === 'recipes' && <RecipesView />}
        {view === 'leaderboard' && <LeaderboardView />}
        {view === 'alerts' && <AlertsView />}
        {view === 'me' && <MeView />}
      </main>
      <footer className="foot">
        <span>Pantry Pass · BostonHacks 2026 · Boundless Boston track</span>
        <span className="muted">Pantry listings are sample data for the prototype.</span>
      </footer>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className="toast">{t.pts ? <b>+{t.pts} pts</b> : null}<span>{t.msg}</span></div>)}
      </div>
    </AppCtx.Provider>
  )
}
