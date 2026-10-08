import { afterDamage, effectiveSpeed, rollDamage } from './combat'
import { CREATURES, hasAbility } from './creatures'
import type { Hero } from './heroes'
import { hexDistance, hexKey, neighbors, sameHex, type Hex } from './hex'
import { attackMode, pathLength, reachableHexes } from './movement'
import { createRandom, type Random } from './random'
import { cureAmount, isEffect, OPPOSITE_EFFECT, SPELLS, spellDamage, type SpellId } from './spells'
import type { BattleEvent, Casualties, GameState, Move, Player, Unit } from './types'
import { opponentOf, PLAYER_NAMES } from './types'

const MAX_LOG = 80

export function activeUnit(state: GameState): Unit | undefined {
  return state.units.find((unit) => unit.id === state.queue[0])
}

/**
 * Turn order for a round: faster stacks first. Stacks with equal speed
 * alternate between the sides, and the side that goes first swaps each round.
 */
export function buildQueue(units: Unit[], round: number): string[] {
  const firstPlayer: Player = round % 2 === 1 ? 'red' : 'blue'
  const speeds = [...new Set(units.map(effectiveSpeed))].sort((higher, lower) => lower - higher)
  const queue: string[] = []
  for (const speed of speeds) {
    const group = units.filter((unit) => effectiveSpeed(unit) === speed)
    const firstSide = group.filter((unit) => unit.owner === firstPlayer)
    const secondSide = group.filter((unit) => unit.owner !== firstPlayer)
    for (let index = 0; index < Math.max(firstSide.length, secondSide.length); index++) {
      if (firstSide[index]) queue.push(firstSide[index].id)
      if (secondSide[index]) queue.push(secondSide[index].id)
    }
  }
  return queue
}

/** Why the active player's hero can't cast this spell on this stack, or null if they can. */
export function castProblem(state: GameState, spell: SpellId, targetId: string): string | null {
  const actor = activeUnit(state)
  if (!actor || state.winner) return 'The battle is over.'
  const hero = state.heroes[actor.owner]
  const target = state.units.find((unit) => unit.id === targetId)
  if (hero.hasCastThisRound) return 'Your hero has already cast a spell this round.'
  if (hero.mana < SPELLS[spell].cost) return 'Not enough mana.'
  if (!target) return 'No target.'
  const wantsEnemy = SPELLS[spell].target === 'enemy'
  if (wantsEnemy !== (target.owner !== actor.owner)) return wantsEnemy ? 'Target an enemy stack.' : 'Target one of your stacks.'
  return null
}

/** A mutable workng copy used while one move is resolved. */
interface Draft {
  units: Unit[]
  heroes: Record<Player, Hero>
  casualties: Casualties
  events: BattleEvent[]
  log: string[]
  random: Random
}

function getUnit(draft: Draft, id: string): Unit | undefined {
  return draft.units.find((unit) => unit.id === id)
}

function updateUnit(draft: Draft, id: string, changes: Partial<Unit>) {
  draft.units = draft.units.map((unit) => (unit.id === id ? { ...unit, ...changes } : unit))
}

const describe = (unit: Unit): string => `${unit.label} (${unit.count})`

function walk(draft: Draft, obstacles: GameState['obstacles'], unitId: string, destination: Hex): number | null {
  const unit = getUnit(draft, unitId)!
  const path = reachableHexes({ units: draft.units, obstacles }, unit).get(hexKey(destination))
  if (!path) return null
  updateUnit(draft, unitId, { position: destination })
  const flying = hasAbility(unit.type, 'flying')
  draft.events.push({ kind: 'move', unitId, path, flying })
  draft.log.push(`${unit.label} ${flying ? 'fly' : 'move'}.`)
  return pathLength(path)
}

function recordLosses(draft: Draft, unit: Unit, kills: number) {
  const losses = draft.casualties[unit.owner]
  losses[unit.type] = (losses[unit.type] ?? 0) + kills
}

function strike(
  draft: Draft,
  attackerId: string,
  targetId: string,
  options: { ranged: boolean; retaliation: boolean; splash: boolean; hexesMoved: number },
) {
  const attacker = getUnit(draft, attackerId)!
  const target = getUnit(draft, targetId)!
  const roll = rollDamage(
    attacker,
    draft.heroes[attacker.owner],
    target,
    draft.heroes[target.owner],
    { ranged: options.ranged, hexesMoved: options.hexesMoved, canBeLucky: !options.splash },
    draft.random,
  )
  const result = afterDamage(target, roll.damage)
  updateUnit(draft, targetId, { count: result.count, topHp: result.topHp })
  recordLosses(draft, target, result.kills)
  draft.events.push({
    kind: 'attack',
    attackerId,
    targetId,
    damage: roll.damage,
    kills: result.kills,
    ranged: options.ranged,
    retaliation: options.retaliation,
    splash: options.splash,
    lucky: roll.lucky,
    deathblow: roll.deathblow,
    targetCount: result.count,
    targetTopHp: result.topHp,
  })

  if (roll.lucky) draft.log.push(`Lucky strike! ${attacker.label} deal double damage.`)
  if (roll.deathblow) draft.log.push(`Deathblow! ${attacker.label} deal double damage.`)
  const verb = options.splash ? 'The death cloud hits' : options.retaliation ? 'strike back at' : options.ranged ? 'shoot' : 'attack'
  const subject = options.splash ? '' : `${describe(attacker)} `
  draft.log.push(`${subject}${verb} ${target.label} for ${roll.damage}. ${result.kills} perish.`)
  if (result.count === 0) {
    draft.events.push({ kind: 'death', unitId: targetId })
    draft.log.push(`${target.label} are destroyed!`)
  }
}

function performAttack(draft: Draft, state: GameState, actor: Unit, targetId: string, from?: Hex): boolean {
  const target = getUnit(draft, targetId)
  if (!target) return false
  const mode = attackMode(state, actor, target)
  if (!mode) return false

  if (mode === 'shoot') {
    updateUnit(draft, actor.id, { shots: actor.shots - 1 })
    strike(draft, actor.id, targetId, { ranged: true, retaliation: false, splash: false, hexesMoved: 0 })
    if (hasAbility(actor.type, 'deathCloud')) {
      for (const neighbor of neighbors(target.position)) {
        const caught = draft.units.find((unit) => sameHex(unit.position, neighbor) && unit.count > 0)
        if (caught && !hasAbility(caught.type, 'undead')) {
          strike(draft, actor.id, caught.id, { ranged: true, retaliation: false, splash: true, hexesMoved: 0 })
        }
      }
    }
    return true
  }

  const origin = from ?? actor.position
  if (hexDistance(origin, target.position) !== 1) return false
  let hexesMoved = 0
  if (!sameHex(origin, actor.position)) {
    const walked = walk(draft, state.obstacles, actor.id, origin)
    if (walked === null) return false
    hexesMoved = walked
  }
  strike(draft, actor.id, targetId, { ranged: false, retaliation: false, splash: false, hexesMoved })

  const victim = getUnit(draft, targetId)!
  if (victim.count > 0 && victim.retaliationsLeft > 0 && !hasAbility(actor.type, 'noRetaliation')) {
    updateUnit(draft, targetId, { retaliationsLeft: victim.retaliationsLeft - 1 })
    strike(draft, targetId, actor.id, { ranged: false, retaliation: true, splash: false, hexesMoved: 0 })
  }
  return true
}

function castSpell(draft: Draft, caster: Player, spell: SpellId, targetId: string) {
  const hero = draft.heroes[caster]
  draft.heroes = { ...draft.heroes, [caster]: { ...hero, mana: hero.mana - SPELLS[spell].cost, hasCastThisRound: true } }
  const target = getUnit(draft, targetId)!
  const event: BattleEvent = {
    kind: 'spell',
    spell,
    caster,
    targetId,
    damage: 0,
    kills: 0,
    targetCount: target.count,
    targetTopHp: target.topHp,
  }
  draft.log.push(`${hero.name} casts ${SPELLS[spell].name} on ${target.label}.`)

  const damage = spellDamage(spell, hero.spellPower)
  if (damage > 0) {
    const result = afterDamage(target, damage)
    updateUnit(draft, targetId, { count: result.count, topHp: result.topHp })
    recordLosses(draft, target, result.kills)
    Object.assign(event, { damage, kills: result.kills, targetCount: result.count, targetTopHp: result.topHp })
    draft.events.push(event)
    draft.log.push(`${target.label} take ${damage} damage. ${result.kills} perish.`)
    if (result.count === 0) {
      draft.events.push({ kind: 'death', unitId: targetId })
      draft.log.push(`${target.label} are destroyed!`)
    }
    return
  }

  if (spell === 'cure') {
    const topHp = Math.min(CREATURES[target.type].hp, target.topHp + cureAmount(hero.spellPower))
    const effects = target.effects.filter((active) => active.effect !== 'slow' && active.effect !== 'curse')
    updateUnit(draft, targetId, { topHp, effects })
    event.targetTopHp = topHp
  } else if (isEffect(spell)) {
    const opposite = OPPOSITE_EFFECT[spell]
    const effects = target.effects.filter((active) => active.effect !== spell && active.effect !== opposite)
    updateUnit(draft, targetId, { effects: [...effects, { effect: spell, roundsLeft: Math.max(1, hero.spellPower) }] })
  }
  draft.events.push(event)
}

function winnerOf(units: Unit[]): Player | null {
  if (!units.some((unit) => unit.owner === 'blue')) return 'red'
  if (!units.some((unit) => unit.owner === 'red')) return 'blue'
  return null
}

/** Called when a unit becomes active: its defend wears off and wraiths regenerate. */
function startTurn(draft: Draft, unitId: string) {
  const unit = getUnit(draft, unitId)
  if (!unit) return
  updateUnit(draft, unitId, { defending: false })
  const fullHp = CREATURES[unit.type].hp
  if (hasAbility(unit.type, 'regenerate') && !unit.waited && unit.topHp < fullHp) {
    updateUnit(draft, unitId, { topHp: fullHp })
    draft.events.push({ kind: 'regenerate', unitId, topHp: fullHp })
    draft.log.push(`${unit.label} regenerate.`)
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
  return buildQueue(draft.units, round)
}

/** Applies the active unit's move. Returns the same state object if the move is not allowed. */
export function applyMove(state: GameState, move: Move): GameState {
  const actor = activeUnit(state)
  if (state.winner || !actor) return state

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
      if (walk(draft, state.obstacles, actor.id, move.to) === null) return state
      canTriggerMorale = true
      break
    case 'attack':
      if (!performAttack(draft, state, actor, move.targetId, move.from)) return state
      canTriggerMorale = true
      break
    case 'defend':
      updateUnit(draft, actor.id, { defending: true })
      draft.events.push({ kind: 'defend', unitId: actor.id })
      draft.log.push(`${actor.label} defend.`)
      break
    case 'wait':
      if (actor.waited) return state
      updateUnit(draft, actor.id, { waited: true })
      draft.events.push({ kind: 'wait', unitId: actor.id })
      draft.log.push(`${actor.label} wait.`)
      queue = [...queue.slice(1), actor.id]
      endsTurn = false
      break
    case 'cast':
      if (castProblem(state, move.spell, move.targetId)) return state
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
    startTurn(draft, queue[0])
    return finish(state, draft, { queue, round, winner: null, retreated: null })
  }
  if (!endsTurn) return finish(state, draft, { queue, round, winner: null, retreated: null })

  const actorAfter = getUnit(draft, actor.id)
  const hero = draft.heroes[actor.owner]
  const moraleApplies = actorAfter && !hasAbility(actor.type, 'undead') && !actorAfter.hadMoraleTurn && hero.morale > 0
  if (canTriggerMorale && moraleApplies && draft.random.chance(hero.morale / 24)) {
    updateUnit(draft, actor.id, { hadMoraleTurn: true })
    draft.events.push({ kind: 'morale', unitId: actor.id })
    draft.log.push(`Good morale! ${actor.label} act again.`)
    return finish(state, draft, { queue, round, winner: null, retreated: null })
  }

  queue = queue.filter((id) => id !== actor.id)
  if (queue.length === 0) {
    round++
    queue = startRound(draft, round)
  }
  startTurn(draft, queue[0])
  return finish(state, draft, { queue, round, winner: null, retreated: null })
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
