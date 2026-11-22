import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import alertIcon from './assets/icons/alert.png?inline'
import cornucopiaIcon from './assets/icons/cornucopia.png?inline'
import mapIcon from './assets/icons/map.png?inline'
import peopleIcon from './assets/icons/people.png?inline'
import trainIcon from './assets/icons/TRAIN.png?inline'
import { connect, type Api } from './api'
import { Avatar } from './components/ui'
import { AppCtx, type Ctx, type View } from './context'
import { haversineKm } from './geo'
import { setUserId } from './session'
import type { Earned, Me, Pantry, User } from './types'
import AlertsView from './views/AlertsView'
import LeaderboardView from './views/LeaderboardView'
import MeView from './views/MeView'
import PantriesView from './views/PantriesView'
import RecipesView from './views/RecipesView'

const VIEWS: { id: View; label: string; icon?: string }[] = [
  { id: 'pantries', label: 'Pantries', icon: mapIcon },
  { id: 'recipes', label: 'Recipes' },
  { id: 'leaderboard', label: 'Leaderboard', icon: peopleIcon },
  { id: 'alerts', label: 'Alerts', icon: alertIcon },
  { id: 'me', label: 'My points', icon: trainIcon },
]
const BU: [number, number] = [42.3505, -71.1054]
const fromHash = (): View => (VIEWS.find((v) => `#${v.id}` === location.hash)?.id ?? 'pantries')

function Logo() {
  return <img className="brand-icon" src={cornucopiaIcon} width="36" height="36" alt="" />
}

export default function App() {
  const [conn, setConn] = useState<{ api: Api; mode: 'live' | 'demo'; gemini: boolean } | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [pantryRows, setPantryRows] = useState<Pantry[]>([])
  const [view, setView] = useState<View>(fromHash())
  const [focusPantry, setFocusPantry] = useState<number | null>(null)
  const [loc, setLoc] = useState<[number, number]>(BU)
  const [toasts, setToasts] = useState<{ id: number; msg: string; pts?: number }[]>([])
  const [unread, setUnread] = useState(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerToggle = useRef<HTMLButtonElement>(null)

  const closeDrawer = () => {
    setDrawerOpen(false)
    drawerToggle.current?.focus()
  }

  // Pantry coordinates are public; the visitor's session-only map position stays in the browser.
  const pantries = useMemo(() => pantryRows.map((p) => ({
    ...p,
    distance_km: Math.round(haversineKm(loc[0], loc[1], p.lat, p.lng) * 100) / 100,
  })).sort((a, b) => a.distance_km - b.distance_km), [pantryRows, loc])

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
  const reloadPantries = useCallback(async () => { if (conn) setPantryRows(await conn.api.pantries()) }, [conn])

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

  if (!ctx) return <div className="boot"><Logo /><p>Loading SaverMeal…</p></div>

  return (
    <AppCtx.Provider value={ctx}>
      <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}${drawerOpen ? ' drawer-open' : ''}`}
        onKeyDown={(event) => { if (drawerOpen && event.key === 'Escape') closeDrawer() }}>
        <button ref={drawerToggle} className="btn drawer-toggle" type="button"
          aria-expanded={drawerOpen} aria-controls="sidebar" onClick={() => setDrawerOpen(!drawerOpen)}>
          {drawerOpen ? 'Close menu' : 'Menu'}
        </button>
        {drawerOpen && <div className="drawer-scrim" aria-hidden="true" onClick={closeDrawer} />}
        <aside id="sidebar" className="sidebar" aria-label="SaverMeal sidebar">
          <a className="brand" href="#pantries" aria-label="SaverMeal home" onClick={() => { setFocusPantry(null); if (drawerOpen) closeDrawer() }}>
            <Logo /><span className="sidebar-label">SaverMeal<small>Boston</small></span>
          </a>
          <button className="btn sidebar-toggle" type="button" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed} aria-controls="sidebar" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <span aria-hidden="true">{sidebarCollapsed ? '»' : '«'}</span><span className="sidebar-label">Collapse</span>
          </button>
          <nav aria-label="Main">
            {VIEWS.map((v) => (
              <a key={v.id} href={`#${v.id}`} className={view === v.id ? 'on' : ''} title={v.label}
                aria-label={v.id === 'alerts' && unread > 0 ? `Alerts, ${unread} unread` : v.label}
                aria-current={view === v.id ? 'page' : undefined}
                onClick={() => { if (v.id === 'pantries') setFocusPantry(null); if (drawerOpen) closeDrawer() }}>
                {v.icon ? <img className="nav-icon" src={v.icon} width="26" height="26" alt="" /> : (
                  <svg className="nav-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                    <path d="M4 5h6a2 2 0 0 1 2 2 2 2 0 0 1 2-2h6v13h-6a2 2 0 0 0-2 2 2 2 0 0 0-2-2H4zM12 7v13"
                      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                )}
                <span className="sidebar-label">{v.label}</span>
                {v.id === 'alerts' && unread > 0 && <span className="count" aria-hidden="true">{unread}</span>}
              </a>
            ))}
          </nav>
          <div className="sidebar-profile">
            <label className="user-switch">
              <Avatar name={me!.name} line={me!.t_line} size={30} />
              <select value={me!.id} onChange={(e) => switchUser(Number(e.target.value))} aria-label="Signed in as (demo)">
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <a className="pts-pill" href="#me" onClick={() => { if (drawerOpen) closeDrawer() }}><b>{me!.points}</b> pts</a>
          </div>
        </aside>
        <div className={`app-content${view === 'pantries' ? ' map-content' : ''}`}>
          {conn!.mode === 'demo' && <p className="demo-note">Browser demo mode — pantry directory records are historical public listings; inventory and activity are synthetic and reset on reload.</p>}
          <main id="main-content">
            {view === 'pantries' && <PantriesView key={focusPantry ?? 0} />}
            {view === 'recipes' && <RecipesView />}
            {view === 'leaderboard' && <LeaderboardView />}
            {view === 'alerts' && <AlertsView />}
            {view === 'me' && <MeView />}
          </main>
          {view !== 'pantries' && <footer className="foot">
            <span>SaverMeal · BostonHacks 2026 · Boundless Boston track</span>
            <span className="muted">Historical public pantry directory · Demo inventory · Call ahead before visiting.</span>
          </footer>}
        </div>
      </div>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className="toast">{t.pts ? <b>+{t.pts} pts</b> : null}<span>{t.msg}</span></div>)}
      </div>
    </AppCtx.Provider>
  )
}
