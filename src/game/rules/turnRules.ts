/** Turn order and the rhythm of a battle: who acts next, and what happens when a turn or a round begins. */

import { effectiveSpeed } from '../combat'
import { CREATURES, hasAbility, isPassive, isWarMachine } from '../creatures'
import type { GameState, Player, Unit } from '../types'
import { getUnit, updateUnit, type Draft } from './draft'

/** How much health a First Aid Tent restores each round. */
export const FIRST_AID_MINIMUM = 25
export const FIRST_AID_MAXIMUM = 50

export function activeUnit(state: GameState): Unit | undefined {
  return state.units.find((unit) => unit.id === state.queue[0])
}

/**
 * Turn order for a round: faster stacks first. Stacks with equal speed
 * alternate between the sides, and the side that goes first swaps each round.
 * The First Aid Tent and Ammo Cart work on their own and never take a turn.
 */
export function buildQueue(allUnits: Unit[], round: number): string[] {
  const units = allUnits.filter((unit) => !isPassive(unit.type))
  const firstPlayer: Player = round % 2 === 1 ? 'red' : 'blue'
  const speeds = [...new Set(units.map(effectiveSpeed))].sort((higher, lower) => lower - higher)
  const queue: string[] = []

  for (const speed of speeds) {
    const group = units.filter((unit) => effectiveSpeed(unit) === speed)
    const firstSide = group.filter((unit) => unit.owner === firstPlayer)
    const secondSide = group.filter((unit) => unit.owner !== firstPlayer)

    for (let index = 0; index < Math.max(firstSide.length, secondSide.length); index++) {
      if (firstSide[index]) {
        queue.push(firstSide[index].id)
      }

      if (secondSide[index]) {
        queue.push(secondSide[index].id)
      }
    }
  }

  return queue
}

/** Called when a unit becomes active: its defend wears off and wraiths regenerate. */
function startTurn(draft: Draft, unitId: string) {
  const unit = getUnit(draft, unitId)

  if (!unit) {
    return
  }

  updateUnit(draft, unitId, { defending: false })
  const fullHp = CREATURES[unit.type].hp

  if (hasAbility(unit.type, 'regenerate') && !unit.waited && unit.topHp < fullHp) {
    updateUnit(draft, unitId, { topHp: fullHp })
    draft.events.push({ kind: 'regenerate', unitId, topHp: fullHp })
    draft.log.push(`${unit.label} regenerate.`)
  }
}

/**
 * Starts the turn of the stack at the front of the queue, beginning a new round when the queue is empty.
 * Petrified stacks are skipped and come out of the stone.
 */
export function beginNextTurn(draft: Draft, queue: string[], round: number): { queue: string[]; round: number } {
  for (;;) {
    if (queue.length === 0) {
      round++
      queue = startRound(draft, round)
    }

    const unit = getUnit(draft, queue[0])!

    if (unit.petrified && !unit.lostTurn) {
      updateUnit(draft, unit.id, { lostTurn: true, defending: false })
      draft.events.push({ kind: 'stoneSkip', unitId: unit.id })
      draft.log.push(`${unit.label} are stone and lose their turn.`)
      queue = queue.slice(1)
      continue
    }

    if (unit.petrified) {
      updateUnit(draft, unit.id, { petrified: false, lostTurn: false })
      draft.log.push(`${unit.label} break free of the stone.`)
    }

    startTurn(draft, unit.id)

    return { queue, round }
  }
}

function startRound(draft: Draft, round: number): string[] {
  draft.units = draft.units.map((unit) => ({
    ...unit,
    retaliationsLeft: hasAbility(unit.type, 'doubleRetaliation') ? 2 : 1,
    waited: false,
    hadMoraleTurn: false,
    effects: unit.effects
      .map((active) => ({ ...active, roundsLeft: active.roundsLeft - 1 }))
      .filter((active) => active.roundsLeft > 0),
  }))
  draft.heroes = {
    red: { ...draft.heroes.red, hasCastThisRound: false },
    blue: { ...draft.heroes.blue, hasCastThisRound: false },
  }
  draft.log.push(`— Round ${round} —`)
  giveFirstAid(draft)

  return buildQueue(draft.units, round)
}

/** Each First Aid Tent tends the top creature of its side's most wounded stack. */
function giveFirstAid(draft: Draft) {
  const missingHp = (unit: Unit) => CREATURES[unit.type].hp - unit.topHp

  for (const tent of draft.units.filter((unit) => hasAbility(unit.type, 'firstAid'))) {
    const patients = draft.units.filter((unit) => unit.owner === tent.owner && !isWarMachine(unit.type) && missingHp(unit) > 0)

    if (patients.length === 0) {
      continue
    }

    const patient = patients.reduce((worst, unit) => (missingHp(unit) > missingHp(worst) ? unit : worst))
    const amount = Math.min(missingHp(patient), draft.random.integer(FIRST_AID_MINIMUM, FIRST_AID_MAXIMUM))
    const topHp = patient.topHp + amount
    updateUnit(draft, patient.id, { topHp })
    draft.events.push({ kind: 'heal', unitId: patient.id, healerId: tent.id, amount, topHp })
    draft.log.push(`${tent.label} heals ${patient.label} for ${amount}.`)
  }
}
