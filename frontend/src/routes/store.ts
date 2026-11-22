import { initialState, type State } from './domain.ts'

let connection: Promise<IDBDatabase> | undefined
function database() {
  if (!connection)
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('savermeal-routes', 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore('records')
        request.result.createObjectStore('photos')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    }).catch((e) => {
      connection = undefined
      throw e
    })
  return connection
}
const channel =
  typeof BroadcastChannel === 'function' ? new BroadcastChannel('savermeal-routes-changes') : null
export const listen = (refresh: () => void) => {
  channel?.addEventListener('message', refresh)
  window.addEventListener('focus', refresh)
  return () => {
    channel?.removeEventListener('message', refresh)
    window.removeEventListener('focus', refresh)
  }
}
type Mutation = (state: State, photos: IDBObjectStore) => void
export async function commit(mutate?: Mutation, generation?: string): Promise<State> {
  const db = await database()
  // Reading and changing the ledger in the same read/write transaction serializes competing tabs.
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['records', 'photos'], 'readwrite')
    const records = tx.objectStore('records'),
      photos = tx.objectStore('photos')
    const read = records.get('state')
    let state: State
    let failure: unknown
    read.onsuccess = () => {
      try {
        state = read.result ?? initialState()
        if (state.version !== 1) throw Error('Unsupported storage version. Open the latest app.')
        if (generation && generation !== state.generation)
          throw Error('The scenario was reset in another tab. Please try again.')
        mutate?.(state, photos)
        if (mutate || !read.result) records.put(state, 'state')
      } catch (e) {
        failure = e
        tx.abort()
      }
    }
    tx.oncomplete = () => {
      if (mutate) channel?.postMessage('changed')
      resolve(state)
    }
    tx.onabort = () =>
      reject(failure ?? tx.error ?? Error('Storage write failed. Your previous data is intact.'))
  })
}
export async function preparePhoto(file: Blob) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw Error('Choose a JPEG, PNG or WebP image.')
  if (!file.size || file.size > 12 * 1024 * 1024) throw Error('Choose an image under 12 MiB.')
  const bitmap = await createImageBitmap(file).catch(() => {
    throw Error('This image could not be decoded.')
  })
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height))
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw Error('Image conversion is unavailable.')
  }
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(Error('Image conversion failed.'))), 'image/jpeg', 0.77),
  )
  if (!blob.size || blob.type !== 'image/jpeg' || blob.size > 1024 * 1024)
    throw Error('The converted image exceeds the 1 MiB limit. Choose a smaller image.')
  const verified = await createImageBitmap(blob)
  verified.close()
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return { blob, hash: Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('') }
}
export async function getPhoto(id: string): Promise<Blob | undefined> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const r = db.transaction('photos').objectStore('photos').get(id)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
