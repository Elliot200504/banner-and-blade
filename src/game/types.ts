import type { CreatureType, Faction } from './creatures'
import type { Hero } from './heroes'
import type { Hex } from './hex'
import type { EffectId, SpellId } from './spells'

export type Player = 'red' | 'blue'

export const PLAYER_NAMES: Record<Player, string> = { red: 'Red', blue: 'Blue' }

export const opponentOf = (player: Player): Player => (player === 'red' ? 'blue' : 'red')

export interface ActiveEffect {
  effect: EffectId
  roundsLeft: number
}

/** A stack of identical creatures. */
export interface Unit {
  id: string
  label: string
  type: CreatureType
  owner: Player
  position: Hex
  count: number
  /** HP of the top creature; the others are at full health. */
  topHp: number
  shots: number
  retaliationsLeft: number
  /** Defending until its next turn. */
  defending: boolean
  /** Has used Wait this round. */
  waited: boolean
  /** Has had a good-morale extra turn this round. */
  hadMoraleTurn: boolean
  /** Turned to stone: loses its next turn and cannot strike back until then. */
  petrified: boolean
  effects: ActiveEffect[]
}

export type ObstacleKind = 'rock' | 'tree' | 'deadTree'

export interface Obstacle {
  position: Hex
  kind: ObstacleKind
}

export type Move =
  | { type: 'move'; to: Hex }
  /** Shoots if possible; otherwise a melee attack, walking to `from` first when given. */
  | { type: 'attack'; targetId: string; from?: Hex }
  | { type: 'defend' }
  | { type: 'wait' }
  /** The active player's hero casts a spell. Does not end the unit's turn. */
  | { type: 'cast'; spell: SpellId; targetId: string }
  | { type: 'retreat' }

/** What happened during the last move, in order. Used for the log and animations. */
export type BattleEvent =
  | { kind: 'move'; unitId: string; path: Hex[]; flying: boolean }
  | {
      kind: 'attack'
      attackerId: string
      targetId: string
      damage: number
      kills: number
      ranged: boolean
      retaliation: boolean
      splash: boolean
      lucky: boolean
      deathblow: boolean
      targetCount: number
      targetTopHp: number
    }
  | { kind: 'death'; unitId: string }
  | { kind: 'defend'; unitId: string }
  | { kind: 'wait'; unitId: string }
  | { kind: 'morale'; unitId: string }
  | { kind: 'regenerate'; unitId: string; topHp: number }
  | { kind: 'petrify'; unitId: string }
  /** A petrified stack's turn comes up and is skipped. */
  | { kind: 'stoneSkip'; unitId: string }
  | {
      kind: 'spell'
      spell: SpellId
      caster: Player
      targetId: string
      damage: number
      kills: number
      targetCount: number
      targetTopHp: number
    }
  | { kind: 'retreat'; player: Player }

export type Casualties = Record<Player, Partial<Record<CreatureType, number>>>

export interface GameState {
  units: Unit[]
  heroes: Record<Player, Hero>
  factions: Record<Player, Faction>
  obstacles: Obstacle[]
  round: number
  /** Unit ids still to act this round. The first one is the active unit. */
  queue: string[]
  winner: Player | null
  retreated: Player | null
  casualties: Casualties
  log: string[]
  events: BattleEvent[]
  /** Seed for the next random roll (damage, luck, morale…). */
  seed: number
}
