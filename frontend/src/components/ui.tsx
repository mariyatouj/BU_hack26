import { useEffect, useState, type ReactNode } from 'react'

export function Stars({ value, onChange, label }: { value: number; onChange?: (v: number) => void; label?: string }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <span className={`stars${onChange ? ' edit' : ''}`} role={onChange ? 'radiogroup' : 'img'}
      aria-label={label ?? `${value.toFixed(1)} out of 5`} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, shown - (i - 1)))
        const star = (
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
            <defs>
              <linearGradient id={`g${i}${Math.round(fill * 10)}`}>
                <stop offset={fill} stopColor="currentColor" />
                <stop offset={fill} stopColor="var(--line)" />
              </linearGradient>
            </defs>
            <path d="M10 1.5l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L10 14.8 4.6 17.7l1.2-5.9L1.4 7.7l6-.7z" fill={`url(#g${i}${Math.round(fill * 10)})`} />
          </svg>
        )
        return onChange ? (
          <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(i)} onClick={() => onChange(i)}>{star}</button>
        ) : <span key={i}>{star}</span>
      })}
    </span>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function Chips({ options, value, onChange, multi }: { options: string[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button key={o} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o) : multi ? [...value, o] : [o])}>{o}</button>
        )
      })}
    </div>
  )
}

export const LEVEL_LABEL: Record<string, string> = { out: 'Out', low: 'Low', medium: 'Some', high: 'Plenty' }

export function StockBar({ level }: { level: string }) {
  const pct = { out: 0, low: 25, medium: 60, high: 100 }[level] ?? 0
  return <span className={`stock ${level}`} aria-label={LEVEL_LABEL[level]}><i style={{ width: `${pct}%` }} /></span>
}

export function ago(iso: string | null) {
  if (!iso) return 'never'
  const h = (Date.now() - new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z').getTime()) / 36e5
  if (h < 1) return 'just now'
  if (h < 24) return `${Math.round(h)}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}

export const ACTION_LABEL: Record<string, string> = {
  share_recipe: 'Shared a recipe', recipe_photo: 'Added a dish photo', rate_recipe: 'Rated a recipe',
  rate_pantry: 'Rated a pantry', visit_pantry: 'Checked in at a pantry', submit_pantry: 'Pantry verified',
  update_inventory: 'Reported pantry stock',
}

export const CULTURES = ['Chinese', 'Latin American', 'South Asian', 'Middle Eastern', 'American', 'Italian', 'Irish', 'Korean', 'Vietnamese', 'Caribbean', 'West African']
export const DIETS = ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten free', 'Dairy free', 'Nut free']
export const LINE_COLOR: Record<string, string> = { Red: '#da291c', Green: '#00843d', Orange: '#ed8b00', Blue: '#003da5', Silver: '#7c878e' }

export function Avatar({ name, line, size = 36 }: { name: string; line?: string | null; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: LINE_COLOR[line ?? ''] ?? 'var(--ink)' }} aria-hidden>
      {initials}
    </span>
  )
}
