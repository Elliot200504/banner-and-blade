import { afterDamage, CURSE_CHANCE, CURSE_ROUNDS, effectiveSpeed, PETRIFY_CHANCE, rollDamage, totalHp } from './combat'
import { CREATURES, hasAbility } from './creatures'
import { isSpellSpecialist, type Hero } from './heroes'
import { hexDistance, hexKey, neighbors, sameHex, type Hex } from './hex'
import { attackMode, pathLength, reachableHexes } from './movement'
import { createRandom, type Random } from './random'
import { animateDeadAmount, cureAmount, isEffect, OPPOSITE_EFFECT, SPELLS, spellDamage, type SpellId } from './spells'
import type { BattleEvent, Casualties, GameState, Move, Player, Unit } from './types'
import { opponentOf, PLAYER_NAMES } from './types'

const MAX_LOG = 80
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

/** Whether the spell can't touch this stack at all. */
export const isImmune = (unit: Unit, spell: SpellId): boolean =>
  hasAbility(unit.type, 'spellImmune') && SPELLS[spell].level <= SPELL_IMMUNITY_LEVEL

/** The stack a dragon's breath also hits: the one right behind the target, seen from where the dragon strikes. */
export function breathVictim(units: Unit[], from: Hex, target: Unit): Unit | undefined {
  const behind = { q: 2 * target.position.q - from.q, r: 2 * target.position.r - from.r }
  return units.find((unit) => unit.id !== target.id && unit.count > 0 && sameHex(unit.position, behind))
}

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

/** Why the active player's hero can't cast this spell (on this stack), or null if they can. */
export function castProblem(state: GameState, spell: SpellId, targetId?: string): string | null {
  const actor = activeUnit(state)
  if (!actor || state.winner) return 'The battle is over.'
  const hero = state.heroes[actor.owner]
  const definition = SPELLS[spell]
  if (!hero.spells.includes(spell)) return `${hero.name} does not know ${definition.name}.`
  if (hero.hasCastThisRound) return 'Your hero has already cast a spell this round.'
  if (hero.mana < definition.cost) return 'Not enough mana.'
  if (definition.target === 'everyone') return null
  const target = state.units.find((unit) => unit.id === targetId)
  if (!target) return 'No target.'
  const wantsEnemy = definition.target === 'enemy'
  if (wantsEnemy !== (target.owner !== actor.owner)) return wantsEnemy ? 'Target an enemy stack.' : 'Target one of your stacks.'
  if (definition.undeadOnly && !hasAbility(target.type, 'undead')) return `${definition.name} only works on the undead.`
  if (isImmune(target, spell)) return `${target.label} are immune to ${definition.name}.`
  return null
}

/** Every stack a spell would hit: the whole living field, the target and its surroundings, or just the target. Immune stacks are left out. */
export function spellVictims(units: Unit[], spell: SpellId, target: Unit | undefined): Unit[] {
  const affected = units.filter((unit) => !isImmune(unit, spell))
  if (spell === 'deathRipple') return affected.filter((unit) => !hasAbility(unit.type, 'undead'))
  if (!target) return []
  if (spell === 'meteorShower') return affected.filter((unit) => hexDistance(unit.position, target.position) <= 1)
  if (spell === 'inferno') return affected.filter((unit) => hexDistance(unit.position, target.position) <= 2)
  return [target]
}

/** A mutable working copy used while one move is resolved. */
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
  const splashVerb = hasAbility(attacker.type, 'breath') ? 'Dragon fire burns' : 'The death cloud hits'
  const verb = options.splash ? splashVerb : options.retaliation ? 'strike back at' : options.ranged ? 'shoot' : 'attack'
  const subject = options.splash ? '' : `${describe(attacker)} `
  draft.log.push(`${subject}${verb} ${target.label} for ${roll.damage}. ${result.kills} perish.`)
  if (result.count === 0) {
    draft.events.push({ kind: 'death', unitId: targetId })
    draft.log.push(`${target.label} are destroyed!`)
  } else if (
    hasAbility(attacker.type, 'petrify') &&
    !options.splash &&
    !target.petrified &&
    draft.random.chance(PETRIFY_CHANCE)
  ) {
    updateUnit(draft, targetId, { petrified: true })
    draft.events.push({ kind: 'petrify', unitId: targetId })
    draft.log.push(`${target.label} are turned to stone!`)
  } else if (
    hasAbility(attacker.type, 'cursing') &&
    !options.ranged &&
    !options.splash &&
    !isImmune(target, 'curse') &&
    draft.random.chance(CURSE_CHANCE)
  ) {
    const effects = target.effects.filter((active) => active.effect !== 'curse' && active.effect !== 'bless')
    updateUnit(draft, targetId, { effects: [...effects, { effect: 'curse', roundsLeft: CURSE_ROUNDS }] })
    draft.log.push(`${target.label} are cursed!`)
  }
}

/** Whether a magic-resistant stack shrugs off a hostile spell. Rolls only for enemies of the caster. */
function resists(draft: Draft, victim: Unit, caster: Player, spell: SpellId): boolean {
  if (victim.owner === caster || !hasAbility(victim.type, 'magicResistance')) return false
  if (!draft.random.chance(MAGIC_RESISTANCE_CHANCE)) return false
  draft.log.push(`${victim.label} resist ${SPELLS[spell].name}!`)
  return true
}

/** A melee blow, plus the dragon's breath on whoever stands behind the target. */
function meleeStrike(draft: Draft, attackerId: string, targetId: string, options: { retaliation: boolean; hexesMoved: number }) {
  const attacker = getUnit(draft, attackerId)!
  const target = getUnit(draft, targetId)!
  const burned = hasAbility(attacker.type, 'breath') ? breathVictim(draft.units, attacker.position, target) : undefined
  strike(draft, attackerId, targetId, { ranged: false, splash: false, ...options })
  if (burned) strike(draft, attackerId, burned.id, { ranged: false, retaliation: options.retaliation, splash: true, hexesMoved: 0 })
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
  meleeStrike(draft, actor.id, targetId, { retaliation: false, hexesMoved })

  const victim = getUnit(draft, targetId)!
  const canRetaliate = victim.count > 0 && victim.retaliationsLeft > 0 && !victim.petrified
  if (canRetaliate && !hasAbility(actor.type, 'noRetaliation')) {
    updateUnit(draft, targetId, { retaliationsLeft: victim.retaliationsLeft - 1 })
    meleeStrike(draft, targetId, actor.id, { retaliation: true, hexesMoved: 0 })
  }

  const survivor = getUnit(draft, actor.id)!
  if (hasAbility(actor.type, 'hitAndRun') && survivor.count > 0 && !sameHex(survivor.position, actor.position)) {
    updateUnit(draft, actor.id, { position: actor.position })
    draft.events.push({ kind: 'move', unitId: actor.id, path: [survivor.position, actor.position], flying: true })
    draft.log.push(`${actor.label} fly back.`)
  }
  return true
}

function castSpell(draft: Draft, caster: Player, spell: SpellId, targetId: string | undefined) {
  const hero = draft.heroes[caster]
  const definition = SPELLS[spell]
  draft.heroes = { ...draft.heroes, [caster]: { ...hero, mana: hero.mana - definition.cost, hasCastThisRound: true } }
  const target = targetId === undefined ? undefined : getUnit(draft, targetId)
  draft.log.push(target ? `${hero.name} casts ${definition.name} on ${target.label}.` : `${hero.name} casts ${definition.name}.`)

  const damage = spellDamage(spell, hero)
  if (damage > 0) {
    for (const victim of spellVictims(draft.units, spell, target)) {
      if (resists(draft, victim, caster, spell)) continue
      const result = afterDamage(victim, damage)
      updateUnit(draft, victim.id, { count: result.count, topHp: result.topHp })
      recordLosses(draft, victim, result.kills)
      draft.events.push({
        kind: 'spell',
        spell,
        caster,
        targetId: victim.id,
        damage,
        kills: result.kills,
        targetCount: result.count,
        targetTopHp: result.topHp,
      })
      draft.log.push(`${victim.label} take ${damage} damage. ${result.kills} perish.`)
      if (result.count === 0) {
        draft.events.push({ kind: 'death', unitId: victim.id })
        draft.log.push(`${victim.label} are destroyed!`)
      }
    }
    return
  }

  if (!target) return
  if (resists(draft, target, caster, spell)) {
    // Shrugged off: the spell still flashes, but nothing changes.
  } else if (spell === 'cure') {
    const topHp = Math.min(CREATURES[target.type].hp, target.topHp + cureAmount(hero))
    const effects = target.effects.filter((active) => active.effect !== 'slow' && active.effect !== 'curse')
    updateUnit(draft, target.id, { topHp, effects, petrified: false, lostTurn: false })
  } else if (spell === 'animateDead') {
    // Heals the stack and raises its fallen, up to the size it started the battle with.
    const stats = CREATURES[target.type]
    const health = Math.min(target.startCount * stats.hp, totalHp(target) + animateDeadAmount(hero))
    const count = Math.max(target.count, Math.ceil(health / stats.hp))
    const raised = count - target.count
    updateUnit(draft, target.id, { count, topHp: health - (count - 1) * stats.hp })
    const losses = draft.casualties[target.owner]
    losses[target.type] = Math.max(0, (losses[target.type] ?? 0) - raised)
    if (raised > 0) draft.log.push(`${raised} ${raised === 1 ? stats.name : stats.plural} rise again!`)
  } else if (isEffect(spell)) {
    const opposite = OPPOSITE_EFFECT[spell]
    const effects = target.effects.filter((active) => active.effect !== spell && active.effect !== opposite)
    const boosted = isSpellSpecialist(hero, spell)
    updateUnit(draft, target.id, { effects: [...effects, { effect: spell, roundsLeft: Math.max(1, hero.spellPower), boosted }] })
  }
  const after = getUnit(draft, target.id)!
  draft.events.push({
    kind: 'spell',
    spell,
    caster,
    targetId: target.id,
    damage: 0,
    kills: 0,
    targetCount: after.count,
    targetTopHp: after.topHp,
  })
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

/**
 * Starts the turn of the stack at the front of the queue, beginning a new round when the queue is empty.
 * Petrified stacks are skipped and come out of the stone.
 */
function beginNextTurn(draft: Draft, queue: string[], round: number): { queue: string[]; round: number } {
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
    return finish(state, draft, { ...beginNextTurn(draft, queue, round), winner: null, retreated: null })
  }
  if (!endsTurn) return finish(state, draft, { queue, round, winner: null, retreated: null })

  const actorAfter = getUnit(draft, actor.id)
  const hero = draft.heroes[actor.owner]
  const morale = moraleOf(actor, hero, draft.units)
  const moraleApplies =
    actorAfter && !hasAbility(actor.type, 'undead') && !actorAfter.hadMoraleTurn && !actorAfter.petrified && morale > 0
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
