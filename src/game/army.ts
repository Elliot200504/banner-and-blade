import { CREATURES, FACTIONS, type CreatureType, type Faction } from './creatures'
import type { Random } from './random'

/** Gold each side may spend on recruits. Every standard army fits within it. */
export const ARMY_BUDGET = 11_000

/** The most stacks an army can bring: one of each of its faction's creatures. */
export const MAX_STACKS = 7

export interface ArmyStack {
  type: CreatureType
  count: number
}

/** The stacks a side brings to battle, top to bottom. */
export type Army = ArmyStack[]

/** The fixed army each faction fought with before army building. */
export const standardArmy = (faction: Faction): Army =>
  FACTIONS[faction].creatures.map((type) => ({ type, count: CREATURES[type].armyCount }))

export const armyCost = (army: Army): number =>
  army.reduce((total, stack) => total + stack.count * CREATURES[stack.type].cost, 0)

/** Why this army cannot take the field, or null if it can. */
export function armyProblem(army: Army, faction: Faction): string | null {
  const stacks = army.filter((stack) => stack.count > 0)

  if (stacks.length === 0) {
    return 'Recruit at least one stack.'
  }

  if (stacks.some((stack) => !Number.isInteger(stack.count))) {
    return 'Stacks must be whole creatures.'
  }

  if (stacks.some((stack) => CREATURES[stack.type].faction !== faction)) {
    return `Only ${FACTIONS[faction].name} creatures can join this army.`
  }

  if (new Set(stacks.map((stack) => stack.type)).size !== stacks.length) {
    return 'Each creature can form only one stack.'
  }

  if (armyCost(stacks) > ARMY_BUDGET) {
    return `The army costs more than ${ARMY_BUDGET} gold.`
  }

  return null
}

/** The army with `type` set to `count` creatures, kept in the faction's order. Zero removes the stack. */
export function withStack(army: Army, faction: Faction, type: CreatureType, count: number): Army {
  const counts = new Map(army.map((stack) => [stack.type, stack.count]))
  counts.set(type, count)

  return FACTIONS[faction].creatures
    .filter((creature) => (counts.get(creature) ?? 0) > 0)
    .map((creature) => ({ type: creature, count: counts.get(creature)! }))
}

/** How many of `type` the army could have, spending the gold it has left. */
export function mostAffordable(army: Army, type: CreatureType): number {
  const current = army.find((stack) => stack.type === type)?.count ?? 0

  return current + Math.floor((ARMY_BUDGET - armyCost(army)) / CREATURES[type].cost)
}

/**
 * A random army for the faction: three to six kinds of creature, the budget split
 * between them at random, and any change spent on whatever still fits.
 */
export function randomArmy(faction: Faction, random: Random): Army {
  const pool = [...FACTIONS[faction].creatures]
  const kinds = random.integer(3, Math.min(MAX_STACKS, pool.length))
  const chosen: CreatureType[] = []

  while (chosen.length < kinds) {
    chosen.push(pool.splice(random.integer(0, pool.length - 1), 1)[0])
  }

  const weights = chosen.map(() => 0.5 + random.next())
  const totalWeight = weights.reduce((total, weight) => total + weight, 0)
  let army: Army = []
  chosen.forEach((type, index) => {
    const count = Math.max(1, Math.floor((ARMY_BUDGET * weights[index]) / totalWeight / CREATURES[type].cost))
    army = withStack(army, faction, type, Math.min(count, mostAffordable(army, type)))
  })
  // Spend what's left on the cheapest creature already in the army.
  const cheapest = [...chosen].sort((first, second) => CREATURES[first].cost - CREATURES[second].cost)[0]

  return withStack(army, faction, cheapest, mostAffordable(army, cheapest))
}
