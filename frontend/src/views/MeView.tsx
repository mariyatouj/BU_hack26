import { useEffect, useState } from 'react'
import trainIcon from '../assets/icons/TRAIN.png?inline'
import { ACTION_LABEL, Avatar, ago } from '../components/ui'
import { useApp } from '../context'
import type { Rules } from '../types'

const LEVELS: [number, string][] = [[0, 'Seedling'], [100, 'Sprout'], [250, 'Harvester'], [500, 'Pantry Pro'], [1000, 'Boston Legend']]
const RULE_LABEL: Record<string, string> = {
  share_recipe: 'Share a recipe', recipe_photo: 'Add a dish photo', rate_recipe: "Rate someone's dish", rate_pantry: 'Rate a pantry',
  visit_pantry: 'Check in at a pantry', submit_pantry: 'Submit a pantry (once verified)', update_inventory: 'Report pantry stock',
}

export default function MeView() {
  const { me, api } = useApp()
  const [rules, setRules] = useState<Rules | null>(null)
  useEffect(() => { api.rules().then(setRules) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const idx = LEVELS.findIndex(([, n]) => n === me.level)
  const next = LEVELS[idx + 1]
  const base = LEVELS[idx][0]
  const pct = next ? ((me.points - base) / (next[0] - base)) * 100 : 100

  return (
    <div className="page">
      <section className="me-card">
        <div className="charlie">
          <div className="charlie-top"><span className="charlie-brand"><img src={trainIcon} width="28" height="28" alt="" />SaverMeal</span><span>{me.t_line ? `${me.t_line} Line` : ''}</span></div>
          <div className="charlie-mid"><Avatar name={me.name} line={me.t_line} size={64} /><div><strong>{me.name}</strong><span>{me.university}</span></div></div>
          <div className="charlie-bot"><b>{me.points}</b><span>points · {me.level}</span></div>
        </div>
        <div className="progress">
          <h2>{next ? `${next[0] - me.points} points to ${next[1]}` : 'Top level reached'}</h2>
          <span className="meter big"><i style={{ width: `${pct}%` }} /></span>
          <ol className="levels">{LEVELS.map(([t, n]) => <li key={n} className={me.points >= t ? 'on' : ''}><b>{n}</b><span>{t}+</span></li>)}</ol>
        </div>
      </section>
      <div className="alerts-grid">
        <section>
          <h2>How to earn</h2>
          <table className="rules">
            <tbody>
              {rules && Object.entries(rules.points).map(([k, v]) => <tr key={k}><td>{RULE_LABEL[k] ?? k}</td><td className="num">+{v}</td></tr>)}
            </tbody>
          </table>
          <h2>Prizes</h2>
          <table className="rules">
            <tbody>{rules?.prizes.map((p) => <tr key={p.rank}><td>{p.rank === 1 ? '1st place' : p.rank === 2 ? '2nd place' : p.rank === 3 ? '3rd place' : `Top ${p.rank}`}</td><td>{p.prize}</td></tr>)}</tbody>
          </table>
        </section>
        <section>
          <h2>Recent activity</h2>
          <ul className="history">
            {me.history.map((h, i) => <li key={i}><span>{ACTION_LABEL[h.action] ?? h.action}</span><span className="muted small">{ago(h.created_at)}</span><b>+{h.points}</b></li>)}
            {!me.history.length && <li className="empty">No points yet. Check in at a pantry to start.</li>}
          </ul>
        </section>
      </div>
    </div>
  )
}
