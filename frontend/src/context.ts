import { createContext, useContext } from 'react'
import type { Api } from './api'
import type { Earned, Me, Pantry, User } from './types'

export type View = 'pantries' | 'recipes' | 'leaderboard' | 'alerts' | 'me'

export interface Ctx {
  api: Api
  mode: 'live' | 'demo'
  gemini: boolean
  me: Me
  users: User[]
  refreshMe: () => Promise<void>
  toast: (msg: string) => void
  celebrate: (e: Earned, what: string) => void
  loc: [number, number]
  setLoc: (l: [number, number]) => void
  pantries: Pantry[]
  reloadPantries: () => Promise<void>
  go: (v: View, pantryId?: number) => void
  focusPantry: number | null
}

export const AppCtx = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(AppCtx)
