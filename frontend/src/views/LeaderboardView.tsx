import { useEffect, useState } from 'react'
import { Avatar, Chips, LINE_COLOR, Stars } from '../components/ui'
import { useApp } from '../context'
import type { Leaderboard } from '../types'

const PERIODS: Record<string, string> = { week: 'This week', month: 'This month', all: 'All time' }
const GROUPS: Record<string, string> = { user: 'Contributors', university: 'Universities', t_line: 'T lines' }

export default function LeaderboardView() {
  const { api, me } = useApp()
  const [period, setPeriod] = useState('week')
  const [group, setGroup] = useState('user')
  const [lb, setLb] = useState<Leaderboard | null>(null)

  useEffect(() => { api.leaderboard(period, group).then(setLb) }, [period, group, me.points]) // eslint-disable-line react-hooks/exhaustive-deps

  const max = Math.max(1, ...(lb?.rows.map((r) => r.points) ?? [1]))
  const label = (k: string) => Object.entries(PERIODS).find(([, v]) => v === k)?.[0] ?? k
  const glabel = (k: string) => Object.entries(GROUPS).find(([, v]) => v === k)?.[0] ?? k

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Leaderboard</h1>
          <p className="muted">Weekly and monthly winners earn customized CharlieCards, 7-day T-passes, badges and avatar frames.</p>
        </div>
      </div>
      <div className="toolbar chips-row">
        <Chips options={Object.values(PERIODS)} value={[PERIODS[period]]} onChange={(v) => v[0] && setPeriod(label(v[0]))} />
        <Chips options={Object.values(GROUPS)} value={[GROUPS[group]]} onChange={(v) => v[0] && setGroup(glabel(v[0]))} />
      </div>
      <div className="lb-grid">
        <ol className="board">
          {lb?.rows.map((r) => {
            const isMe = r.user?.id === me.id
            const color = group === 't_line' ? LINE_COLOR[r.key] : undefined
            return (
              <li key={r.key} className={`${isMe ? 'me' : ''} ${r.rank <= 3 ? 'podium' : ''}`}>
                <span className="rank">{r.rank}</span>
                {r.user ? <Avatar name={r.user.name} line={r.user.t_line} /> : <span className="avatar" style={{ background: color ?? 'var(--ink)' }}>{r.key.slice(0, 2)}</span>}
                <span className="who">
                  <strong>{group === 't_line' ? `${r.key} Line` : r.key}{isMe && ' (you)'}</strong>
                  <span className="muted small">
                    {r.user ? `${r.user.university ?? ''} · ${r.user.level}` : `${r.members} contributor${r.members === 1 ? '' : 's'}`}
                  </span>
                  <span className="bar"><i style={{ width: `${(r.points / max) * 100}%`, background: color }} /></span>
                </span>
                <span className="pts">{r.points}<small> pts</small></span>
                {r.prize && <span className="prize">{r.prize}</span>}
              </li>
            )
          })}
          {lb && !lb.rows.length && <li className="empty">No points in this period yet.</li>}
        </ol>
        <aside className="top-recipes">
          <h2>Top community recipes</h2>
          <ol>
            {lb?.top_recipes.map((r) => (
              <li key={r.id}>
                <strong>{r.title}</strong>
                <span className="small">{r.score ? <><Stars value={r.score} /> {r.score.toFixed(1)}</> : 'Not rated yet'}</span>
                <span className="muted small">by {r.author.name}{r.pantry ? ` · ${r.pantry.name}` : ''}</span>
              </li>
            ))}
          </ol>
          {lb && !lb.top_recipes.length && <p className="empty">No recipes in this period.</p>}
        </aside>
      </div>
    </div>
  )
}
