/** The entry point of the rules: applies one move to the battle and decides when it is won. */

import { hasAbility, isWarMachine } from '../creatures'
import { createRandom } from '../random'
import type { GameState, Move, Player, Unit } from '../types'
import { opponentOf, PLAYER_NAMES } from '../types'
import { performAttack, walk } from './attackRules'
import { getUnit, updateUnit, type Draft } from './draft'
import { castProblem, castSpell } from './spellRules'
import { activeUnit, beginNextTurn } from './turnRules'
import { moraleOf } from './unitRules'

const MAX_LOG = 80

/** A side is beaten once its creatures are gone: war machines can't hold the field alone. */
function winnerOf(units: Unit[]): Player | null {
  const fighting = (player: Player) => units.some((unit) => unit.owner === player && !isWarMachine(unit.type))

  if (!fighting('blue')) {
    return 'red'
  }

  if (!fighting('red')) {
    return 'blue'
  }

  return null
}

/** Applies the active unit's move. Returns the same state object if the move is not allowed. */
export function applyMove(state: GameState, move: Move): GameState {
  const actor = activeUnit(state)

  if (state.winner || !actor) {
    return state
  }

  const draft: Draft = {
    units: state.units,
    heroes: state.heroes,
    casualties: { red: { ...state.casualties.red }, blue: { ...state.casualties.blue } },
    events: [],
    log: [],
    random: createRandom(state.seed),
  }
  let queue = state.queue
  let round = state.round
  /** Whether the actor's turn is over (casting a spell does not end it). */
  let endsTurn = true
  /** Only real actions can trigger good morale. */
  let canTriggerMorale = false

  switch (move.type) {
    case 'move':
      if (walk(draft, state.obstacles, actor.id, move.to) === null) {
        return state
      }

      canTriggerMorale = true
      break
    case 'attack':
      if (!performAttack(draft, state, actor, move.targetId, move.from)) {
        return state
      }

      canTriggerMorale = true
      break
    case 'defend':
      updateUnit(draft, actor.id, { defending: true })
      draft.events.push({ kind: 'defend', unitId: actor.id })
      draft.log.push(`${actor.label} defend.`)
      break
    case 'wait':
      if (actor.waited) {
        return state
      }

      updateUnit(draft, actor.id, { waited: true })
      draft.events.push({ kind: 'wait', unitId: actor.id })
      draft.log.push(`${actor.label} wait.`)
      queue = [...queue.slice(1), actor.id]
      endsTurn = false
      break
    case 'cast':
      if (castProblem(state, move.spell, move.targetId)) {
        return state
      }

      castSpell(draft, actor.owner, move.spell, move.targetId)
      endsTurn = false
      break
    case 'retreat': {
      draft.events.push({ kind: 'retreat', player: actor.owner })
      draft.log.push(`${PLAYER_NAMES[actor.owner]} retreats from the battle!`)
      const winner = opponentOf(actor.owner)
      draft.log.push(`${PLAYER_NAMES[winner]} wins the battle!`)

      return finish(state, draft, { queue: [], round, winner, retreated: actor.owner })
    }
  }

  draft.units = draft.units.filter((unit) => unit.count > 0)
  queue = queue.filter((id) => draft.units.some((unit) => unit.id === id))
  const winner = winnerOf(draft.units)

  if (winner) {
    draft.log.push(`${PLAYER_NAMES[winner]} wins the battle!`)

    return finish(state, draft, { queue, round, winner, retreated: null })
  }

  if (move.type === 'wait') {
    return finish(state, draft, { ...beginNextTurn(draft, queue, round), winner: null, retreated: null })
  }

  if (!endsTurn) {
    return finish(state, draft, { queue, round, winner: null, retreated: null })
  }

  const actorAfter = getUnit(draft, actor.id)
  const hero = draft.heroes[actor.owner]
  const morale = moraleOf(actor, hero, draft.units)
  const moraleApplies =
    actorAfter &&
    !hasAbility(actor.type, 'undead') &&
    !isWarMachine(actor.type) &&
    !actorAfter.hadMoraleTurn &&
    !actorAfter.petrified &&
    morale > 0

  if (canTriggerMorale && moraleApplies && draft.random.chance(morale / 24)) {
    updateUnit(draft, actor.id, { hadMoraleTurn: true })
    draft.events.push({ kind: 'morale', unitId: actor.id })
    draft.log.push(`Good morale! ${actor.label} act again.`)

    return finish(state, draft, { queue, round, winner: null, retreated: null })
  }

  queue = queue.filter((id) => id !== actor.id)

  return finish(state, draft, { ...beginNextTurn(draft, queue, round), winner: null, retreated: null })
}

function finish(
  state: GameState,
  draft: Draft,
  outcome: { queue: string[]; round: number; winner: Player | null; retreated: Player | null },
): GameState {
  return {
    ...state,
    ...outcome,
    units: draft.units,
    heroes: draft.heroes,
    casualties: draft.casualties,
    events: draft.events,
    log: [...state.log, ...draft.log].slice(-MAX_LOG),
    seed: draft.random.seed(),
  }
}
