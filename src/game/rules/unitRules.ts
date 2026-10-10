/** What a single stack can and cannot do: morale, spell immunity, ammunition and what its breath reaches. */

import { hasAbility, isWarMachine } from '../creatures'
import type { Hero } from '../heroes'
import type { Hex } from '../hex'
import { occupies } from '../movement'
import { SPELLS, type SpellId } from '../spells'
import type { Unit } from '../types'

/** Chance that a magic-resistant stack shrugs off a hostile spell. */
export const MAGIC_RESISTANCE_CHANCE = 0.2
/** Spells up to this level do nothing to spell-immune stacks. */
export const SPELL_IMMUNITY_LEVEL = 3

/**
 * A morale point is a 1 in 24 chance of an extra turn. Steadfast stacks get one more than
 * their hero, and a living fearsome enemy (a Bone Dragon) takes one away.
 */
export function moraleOf(unit: Unit, hero: Hero, units: Unit[] = []): number {
  const feared = units.some((other) => other.owner !== unit.owner && other.count > 0 && hasAbility(other.type, 'fearsome'))

  return hero.morale + (hasAbility(unit.type, 'steadfast') ? 1 : 0) - (feared ? 1 : 0)
}

/** Whether the spell can't touch this stack at all. War machines ignore every spell. */
export const isImmune = (unit: Unit, spell: SpellId): boolean =>
  isWarMachine(unit.type) || (hasAbility(unit.type, 'spellImmune') && SPELLS[spell].level <= SPELL_IMMUNITY_LEVEL)

/** Whether a shot costs the unit ammunition: war machines and shooters backed by an Ammo Cart shoot for free. */
export function usesAmmunition(units: Unit[], unit: Unit): boolean {
  const supplied = units.some((other) => other.owner === unit.owner && other.count > 0 && hasAbility(other.type, 'ammoSupply'))

  return !isWarMachine(unit.type) && !supplied
}

/** The stack a dragon's breath also hits: the one right behind the target, seen from where the dragon strikes. */
export function breathVictim(units: Unit[], from: Hex, target: Unit): Unit | undefined {
  const behind = { q: 2 * target.position.q - from.q, r: 2 * target.position.r - from.r }

  return units.find((unit) => unit.id !== target.id && unit.count > 0 && occupies(unit, behind))
}
