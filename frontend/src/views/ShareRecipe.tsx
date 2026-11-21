import { useState } from 'react'
import { Chips, CULTURES, DIETS, Modal } from '../components/ui'
import { useApp } from '../context'
import type { RecipeIn } from '../types'

async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
  const scale = Math.min(1, 900 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = img.width * scale
  c.height = img.height * scale
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  URL.revokeObjectURL(url)
  return c.toDataURL('image/jpeg', 0.8)
}

export default function ShareRecipe({ initial, onClose, onShared }: { initial: Partial<RecipeIn>; onClose: () => void; onShared: () => void }) {
  const { api, pantries, celebrate } = useApp()
  const [title, setTitle] = useState(initial.title ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [ingredients, setIngredients] = useState((initial.ingredients ?? []).join('\n'))
  const [steps, setSteps] = useState((initial.steps ?? []).join('\n'))
  const [minutes, setMinutes] = useState(initial.minutes ?? 30)
  const [pantryId, setPantryId] = useState<number | null>(initial.pantry_id ?? null)
  const [culture, setCulture] = useState<string[]>(initial.culture_tags ?? [])
  const [diet, setDiet] = useState<string[]>(initial.dietary_tags ?? [])
  const [photo, setPhoto] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lines(ingredients).length) return setErr('Add at least one ingredient.')
    setBusy(true)
    try {
      const r = await api.createRecipe({
        title, description, ingredients: lines(ingredients), steps: lines(steps), minutes,
        pantry_id: pantryId, culture_tags: culture, dietary_tags: diet, image_url: photo,
      })
      celebrate(r, r.alerts_triggered ? `Recipe shared · pinged ${r.alerts_triggered} neighbor${r.alerts_triggered > 1 ? 's' : ''}` : 'Recipe shared')
      onShared()
    } catch (x) {
      setErr((x as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Share a dish" onClose={onClose} wide>
      <form className="form two" onSubmit={submit}>
        <div>
          <label>Dish name <input required minLength={2} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Five-ingredient fried rice" /></label>
          <label>Where did you get the food?
            <select value={pantryId ?? ''} onChange={(e) => setPantryId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Not from a pantry</option>
              {pantries.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>Ingredients <small className="muted">one per line</small>
            <textarea rows={6} value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder={'2 cups rice\n2 eggs\n1 onion'} />
          </label>
          <label>Steps <small className="muted">one per line</small>
            <textarea rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={'Fry the onion\nAdd rice…'} />
          </label>
        </div>
        <div>
          <label>Short story or tip <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <label>Time (minutes) <input type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>
          <fieldset><legend>Culture</legend><Chips options={CULTURES} value={culture} onChange={setCulture} multi /></fieldset>
          <fieldset><legend>Dietary</legend><Chips options={DIETS} value={diet} onChange={setDiet} multi /></fieldset>
          <label className="photo">
            {photo ? <img src={photo} alt="Your dish" /> : <span>Add a photo of your dish <small>+10 bonus</small></span>}
            <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await shrink(f)) }} />
          </label>
        </div>
        {err && <p className="error">{err}</p>}
        <div className="form-foot">
          <span className="muted small">You'll earn 20 points{photo ? ' + 10 for the photo' : ''}.</span>
          <button className="btn primary" disabled={busy}>{busy ? 'Sharing…' : 'Share recipe'}</button>
        </div>
      </form>
    </Modal>
  )
}
