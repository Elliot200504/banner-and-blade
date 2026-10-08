import type { Hex } from './hex'
import type { UnitType } from './units'

export type Player = 'red' | 'blue'

export const PLAYER_NAMES: Record<Player, string> = { red: 'Red', blue: 'Blue' }

export interface Unit {
  id: string
  label: string
  type: UnitType
  owner: Player
  position: Hex
  hp: number
  /** Already struck back this round. */
  retaliated: boolean
  /** Chose to defend; takes less damage until its next turn. */
  defending: boolean
}

export type Move =
  | { type: 'move'; to: Hex }
  /** Melee units may give `from`: a hex to walk to before striking. */
  | { type: 'attack'; targetId: string; from?: Hex }
  | { type: 'defend' }

/** What happened during the last move, in order. Used for the log and animations. */
export type BattleEvent =
  | { kind: 'move'; unitId: string; path: Hex[] }
  | {
      kind: 'attack'
      attackerId: string
      targetId: string
      damage: number
      ranged: boolean
      retaliation: boolean
      targetHp: number
    }
  | { kind: 'death'; unitId: string }
  | { kind: 'defend'; unitId: string }

export interface GameState {
  units: Unit[]
  obstacles: Hex[]
  round: number
  /** Unit ids still to act this round. The first one is the active unit. */
  queue: string[]
  winner: Player | null
  log: string[]
  events: BattleEvent[]
}
