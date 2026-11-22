import { createContext, useContext } from 'react'
import type { State } from './domain'
export type Write = (fn: (s: State, photos: IDBObjectStore) => void, message?: string) => Promise<boolean>
export const RoutesContext = createContext<{
  state: State
  write: Write
  notify: (s: string) => void
} | null>(null)
export const useRoutes = () => useContext(RoutesContext)!
