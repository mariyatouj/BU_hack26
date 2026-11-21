import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

export type SheetPosition = 'collapsed' | 'half' | 'full'

const POSITIONS: SheetPosition[] = ['collapsed', 'half', 'full']
const LABELS: Record<SheetPosition, string> = { collapsed: 'Collapse', half: 'Half expand', full: 'Fully expand' }

export default function PantrySheet({ position, onPositionChange, count, total, children }: {
  position: SheetPosition
  onPositionChange: (position: SheetPosition) => void
  count: number
  total: number
  children: ReactNode
}) {
  const sheet = useRef<HTMLElement>(null)
  const drag = useRef<{ startY: number; height: number } | null>(null)
  const [dragHeight, setDragHeight] = useState<number | null>(null)

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!sheet.current || !event.isPrimary || event.button !== 0) return
    drag.current = { startY: event.clientY, height: sheet.current.offsetHeight }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const delta = drag.current.startY - event.clientY
    if (Math.abs(delta) >= 6 || dragHeight !== null) setDragHeight(drag.current.height + delta)
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const delta = drag.current.startY - event.clientY
    const step = Math.abs(delta) >= 36 ? Math.sign(delta) : 0
    const index = POSITIONS.indexOf(position)
    const target = step === 0 && Math.abs(delta) < 6 ? (index + 1) % POSITIONS.length : index + step
    onPositionChange(POSITIONS[Math.max(0, Math.min(POSITIONS.length - 1, target))])
    cancelDrag()
  }

  function cancelDrag() {
    drag.current = null
    setDragHeight(null)
  }

  return (
    <section ref={sheet} className="pantry-sheet" data-position={position} aria-labelledby="pantry-sheet-title"
      style={dragHeight === null ? undefined : { minHeight: 0, height: `clamp(0px, ${dragHeight}px, var(--sheet-full))` }}>
      <div className="sheet-head">
        <button className="sheet-handle" type="button" aria-label={position === 'collapsed' ? 'Expand pantry sheet' : 'Resize pantry sheet'} aria-expanded={position !== 'collapsed'} aria-controls="pantry-results"
          onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag}
          onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
          onClick={(event) => { if (event.detail === 0) onPositionChange(POSITIONS[(POSITIONS.indexOf(position) + 1) % POSITIONS.length]) }}>
          <span aria-hidden="true" />
        </button>
        <div className="sheet-title">
          <h1 id="pantry-sheet-title">Pantries near you</h1>
          <span className="muted small" aria-live="polite">{count} of {total} pantries</span>
        </div>
        {position !== 'collapsed' && (
          <div className="sheet-controls" role="group" aria-label="Pantry sheet position">
            {POSITIONS.map((value) => (
              <button className="btn small" type="button" key={value} aria-pressed={position === value}
                onClick={() => {
                  if (value === 'collapsed') sheet.current?.querySelector<HTMLButtonElement>('.sheet-handle')?.focus()
                  onPositionChange(value)
                }}>{LABELS[value]}</button>
            ))}
          </div>
        )}
      </div>
      <div className="sheet-results" id="pantry-results" hidden={position === 'collapsed' && dragHeight === null}>
        {children}
      </div>
    </section>
  )
}
