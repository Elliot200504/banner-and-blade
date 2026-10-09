/** The working copy a move is resolved on, and the small helpers every rule uses to read and change it. */

import type { Hero } from '../heroes'
import type { Random } from '../random'
import type { BattleEvent, Casualties, Player, Unit } from '../types'

/** A mutable working copy used while one move is resolved. */
export interface Draft {
  units: Unit[]
  heroes: Record<Player, Hero>
  casualties: Casualties
  events: BattleEvent[]
  log: string[]
  random: Random
}

export function getUnit(draft: Draft, id: string): Unit | undefined {
  return draft.units.find((unit) => unit.id === id)
}

export function updateUnit(draft: Draft, id: string, changes: Partial<Unit>) {
  draft.units = draft.units.map((unit) => (unit.id === id ? { ...unit, ...changes } : unit))
}

export const describe = (unit: Unit): string => `${unit.label} (${unit.count})`

export function recordLosses(draft: Draft, unit: Unit, kills: number) {
  const losses = draft.casualties[unit.owner]
  losses[unit.type] = (losses[unit.type] ?? 0) + kills
}
