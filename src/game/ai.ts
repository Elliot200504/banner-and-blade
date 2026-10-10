import { afterDamage, damageRange, effectiveSpeed, totalHp } from './combat'
import { CREATURES, hasAbility, isWarMachine } from './creatures'
import type { Hex } from './hex'
import { attackMode, attackOrigins, isEnemyAdjacent, reachableHexes, strikesFrom, unitDistance } from './movement'
import { createRandom } from './random'
import { activeUnit, applyMove, castProblem } from './rules'
import { SPELLS, type EffectId } from './spells'
import type { GameState, Move, Player, Unit } from './types'

/**
 * A one-move-deep computer player. Every legal move is tried on a copy of the
 * state and the results are scored. Dice are rolled with the AI's own seeds and
 * averaged, so it never knows the real rolls in advance.
 */

/** Seeds for the AI's imagined rolls. They have nothing to do with the battle's own seed. */
const SAMPLE_SEEDS = [0x1f2e3d4c, 0x5a6b7c8d, 0x9e8f7a6b, 0x2c4e6a8b, 0x7b9d1f3e, 0xd3c2b1a0, 0x4f6e8d0c, 0xa1b3c5d7]
const WIN_SCORE = 1_000_000
/** How much one point of the AI's mana is worth, so spells are only cast when they pay off. */
const MANA_VALUE = 3
/** After this many rounds, each difficulty's aggression grows by this much per round, so stalemates always break. */
const AGGRESSION_PER_ROUND = 0.05
const PATIENT_ROUNDS = 8
/** Score lost by a shooter with an enemy next to it, as a share of the stack's value. */
const BLOCKED_PENALTY = 0.3
/** The computer gives up once its army is worth less than this share of the enemy's, from this round on. */
const RETREAT_SHARE = 0.15
const RETREAT_FROM_ROUND = 3
/** How much an active effect changes a stack's worth, at full strength. */
const EFFECT_WEIGHT: Record<EffectId, number> = { haste: 0.15, bless: 0.2, stoneSkin: 0.15, slow: -0.2, curse: -0.2 }
/** After the patient rounds, an Expert's fear of enemy blows fades by this share per round, so two careful armies still meet. */
const CAUTION_FADE_PER_ROUND = 0.1
/** An Expert only waits when the best move now gains less than this share of the stack's value over standing still. */
const WAIT_MARGIN = 0.1

export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert'

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'expert']

interface Profile {
  /** How many imagined rolls each move is averaged over. */
  samples: number
  /**
   * How much more an enemy loss counts than an own loss. Without it, two careful armies
   * can stand and defend forever.
   */
  aggression: number
  /** Score lost per hex a stack is beyond striking or shooting distance of the nearest enemy, as a share of its value. */
  distancePenalty: number
  castsSpells: boolean
  /** Waits for the enemy to come closer when it has nothing to attack. */
  waits: boolean
  /** Picks at random among this many of the best moves. */
  choices: number
  /**
   * How much the blows enemies can land before the stack acts again count against a position.
   * This is what makes a stack keep out of reach, shield its shooters and strike first. 0 ignores them.
   */
  threatWeight: number
  /** Worth of an enemy that has used up its retaliation while an ally can still hit it this round, as a share of the blow saved. */
  baitWeight: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { samples: 1, aggression: 1.2, distancePenalty: 0.02, castsSpells: false, waits: false, choices: 3, threatWeight: 0, baitWeight: 0 },
  normal: { samples: 3, aggression: 1.2, distancePenalty: 0.02, castsSpells: true, waits: true, choices: 1, threatWeight: 0, baitWeight: 0 },
  hard: { samples: 8, aggression: 1.5, distancePenalty: 0.03, castsSpells: true, waits: true, choices: 1, threatWeight: 0, baitWeight: 0 },
  expert: { samples: 6, aggression: 1.4, distancePenalty: 0.02, castsSpells: true, waits: true, choices: 1, threatWeight: 0.5, baitWeight: 0.5 },
}

const isShooter = (unit: Unit) => CREATURES[unit.type].range > 0 && unit.shots > 0

/** What one creature is worth in a fight: its health plus how hard it hits. */
function creatureValue(unit: Unit): number {
  const stats = CREATURES[unit.type]
  const averageDamage = (stats.minDamage + stats.maxDamage) / 2

  return stats.hp + 4 * averageDamage * (isShooter(unit) ? 1.5 : 1)
}

function stackValue(unit: Unit): number {
  let value = (totalHp(unit) / CREATURES[unit.type].hp) * creatureValue(unit)

  for (const active of unit.effects) {
    value *= 1 + EFFECT_WEIGHT[active.effect] * Math.min(1, active.roundsLeft / 2)
  }

  if (unit.petrified) {
    value *= unit.lostTurn ? 0.9 : 0.8
  }

  return value
}

const aggression = (profile: Profile, round: number) =>
  profile.aggression + AGGRESSION_PER_ROUND * Math.max(0, round - PATIENT_ROUNDS)

/**
 * How good the state is for `player`: their army minus the enemy's, plus position and mana.
 * Distances are measured to `enemies` as they stood before the move, so that
 * killing the nearest stack never looks like losing ground.
 */
export function scoreState(
  state: GameState,
  player: Player,
  enemies: Unit[],
  profile: Profile = PROFILES.normal,
): number {
  if (state.winner) {
    return state.winner === player ? WIN_SCORE : -WIN_SCORE
  }

  let score = MANA_VALUE * state.heroes[player].mana

  for (const unit of state.units) {
    const value = stackValue(unit)

    if (unit.owner !== player) {
      score -= aggression(profile, state.round) * value
      continue
    }

    score += value

    // War machines stand where they are: distance and blocking mean nothing to them.
    if (isWarMachine(unit.type)) {
      continue
    }

    const nearest = Math.min(...enemies.map((enemy) => unitDistance(unit, enemy)))
    const reach = isShooter(unit) ? CREATURES[unit.type].range : 1 + effectiveSpeed(unit)
    score -= profile.distancePenalty * value * Math.max(0, nearest - reach)

    if (isShooter(unit) && isEnemyAdjacent(state.units, unit)) {
      score -= BLOCKED_PENALTY * value
    }
  }

  return score
}

const armyValue = (state: GameState, player: Player): number =>
  state.units.filter((unit) => unit.owner === player).reduce((total, unit) => total + stackValue(unit), 0)

/** Whether the battle is lost beyond hope: better to flee than to be wiped out. */
export function shouldRetreat(state: GameState, player: Player): boolean {
  if (state.round < RETREAT_FROM_ROUND) {
    return false
  }

  const enemy = state.units.find((unit) => unit.owner !== player)?.owner

  return enemy !== undefined && armyValue(state, player) < RETREAT_SHARE * armyValue(state, enemy)
}

/**
 * Whether the stack should wait rather than make `best`: when it has nothing to attack,
 * no enemy is next to it, and an enemy still has to act this round and may come closer.
 */
function shouldWait(state: GameState, actor: Unit, best: Move): boolean {
  if (actor.waited || best.type === 'attack' || isEnemyAdjacent(state.units, actor)) {
    return false
  }

  return state.queue.slice(1).some((id) => state.units.find((unit) => unit.id === id)?.owner !== actor.owner)
}

const enemiesOf = (state: GameState, player: Player): Unit[] => state.units.filter((unit) => unit.owner !== player)

/*
 * Expert tactics, after how skilled Heroes III players fight:
 * My own personal experience playing the game for thousands of hours 
 * Applying the same principles to the AI, so it can play like a human would.
 * It's not perfect, but it makes the AI more challenging and fun to play against.
 */

const canShoot = (units: Unit[], unit: Unit) => isShooter(unit) && (isWarMachine(unit.type) || !isEnemyAdjacent(units, unit))

/** Whether `defender` would strike back if `attacker` hit it in melee. */
function wouldRetaliate(state: GameState, attacker: Unit, defender: Unit): boolean {
  if (hasAbility(attacker.type, 'noRetaliation') || defender.petrified || isWarMachine(defender.type)) {
    return false
  }

  // A stack that has already struck back this round strikes again once a new round begins.
  return defender.retaliationsLeft > 0 || !state.queue.includes(attacker.id)
}

/** The worth of the creatures an average blow from `attacker` would kill in `target`, and what is left of the target. */
function averageBlow(state: GameState, attacker: Unit, target: Unit, ranged: boolean): { value: number; survivor: Unit } {
  const range = damageRange(attacker, state.heroes[attacker.owner], target, state.heroes[target.owner], { ranged, hexesMoved: 0 })
  const twice = ranged ? hasAbility(attacker.type, 'doubleShot') : hasAbility(attacker.type, 'doubleStrike')
  const damage = Math.min(totalHp(target), ((range.minimum + range.maximum) / 2) * (twice ? 2 : 1))
  const { count, topHp } = afterDamage(target, damage)

  return { value: (damage / totalHp(target)) * stackValue(target), survivor: { ...target, count, topHp } }
}

/** What `attacker` gains by striking `target`: the worth it kills, less the worth the retaliation would kill. */
function exchangeValue(state: GameState, attacker: Unit, target: Unit, ranged: boolean): number {
  const blow = averageBlow(state, attacker, target, ranged)

  if (ranged || blow.survivor.count === 0 || !wouldRetaliate(state, attacker, target)) {
    return blow.value
  }

  return blow.value - averageBlow(state, blow.survivor, attacker, false).value
}

/** Whether `attacker` could walk or fly next to `target` and strike it, given the hexes it can reach. */
function canReachInMelee(attacker: Unit, target: Unit, reach: Map<string, Hex[]>): boolean {
  return (
    unitDistance(attacker, target) === 1 ||
    [...reach.values()].some((path) => strikesFrom(attacker, path[path.length - 1], target))
  )
}

type ReachOf = (unit: Unit) => Map<string, Hex[]>

/** The best exchange `enemy` could make against one of `player`'s stacks from where everyone stands now. */
function worstBlowFrom(state: GameState, enemy: Unit, player: Player, reachOf: ReachOf): number {
  if (enemy.petrified || CREATURES[enemy.type].maxDamage === 0) {
    return 0
  }

  const targets = state.units.filter((unit) => unit.owner === player)

  if (canShoot(state.units, enemy)) {
    const inRange = targets.filter((target) => unitDistance(enemy, target) <= CREATURES[enemy.type].range)

    return Math.max(0, ...inRange.map((target) => exchangeValue(state, enemy, target, true)))
  }

  if (isWarMachine(enemy.type)) {
    return 0
  }

  // Walkers have to go around stacks, so a wall of our units keeps them off whatever stands behind it.
  const reach = reachOf(enemy)
  const inReach = targets.filter((target) => canReachInMelee(enemy, target, reach))

  return Math.max(0, ...inReach.map((target) => exchangeValue(state, enemy, target, false)))
}

/** The worth of a blow saved by an enemy having already struck back, when one of `player`'s stacks still to act can hit it. */
function baitedValue(state: GameState, enemy: Unit, player: Player, reachOf: ReachOf): number {
  if (enemy.retaliationsLeft > 0 || hasAbility(enemy.type, 'unlimitedRetaliation') || isWarMachine(enemy.type)) {
    return 0
  }

  const followers = state.units.filter(
    (unit) =>
      unit.owner === player &&
      state.queue.includes(unit.id) &&
      !isShooter(unit) &&
      !hasAbility(unit.type, 'noRetaliation') &&
      canReachInMelee(unit, enemy, reachOf(unit)),
  )

  return Math.max(0, ...followers.map((follower) => averageBlow(state, enemy, follower, false).value))
}

/** How strongly an Expert still fears enemy blows: fully at first, fading once the battle drags on. */
const caution = (profile: Profile, round: number) =>
  profile.threatWeight * Math.max(0, 1 - CAUTION_FADE_PER_ROUND * Math.max(0, round - PATIENT_ROUNDS))

/**
 * The Expert's read of the position for `player`: the blows every enemy could land before
 * `player`'s stacks act again count against it, and enemies baited out of their retaliation count for it.
 * Zero for the other difficulties.
 */
export function tacticalScore(state: GameState, player: Player, profile: Profile = PROFILES.normal): number {
  if (state.winner || profile.threatWeight === 0) {
    return 0
  }

  const reaches = new Map<string, Map<string, Hex[]>>()
  const reachOf: ReachOf = (unit) => {
    let reach = reaches.get(unit.id)

    if (!reach) {
      reach = reachableHexes(state, unit)
      reaches.set(unit.id, reach)
    }

    return reach
  }
  let score = 0

  for (const enemy of state.units.filter((unit) => unit.owner !== player)) {
    score -= caution(profile, state.round) * worstBlowFrom(state, enemy, player, reachOf)
    score += profile.baitWeight * baitedValue(state, enemy, player, reachOf)
  }

  return score
}

/** The average score of a move over the AI's imagined rolls, or null if the move is not allowed. */
function scoreMove(state: GameState, move: Move, player: Player, profile: Profile): number | null {
  const enemies = enemiesOf(state, player)
  let total = 0
  let tactics = 0

  for (const [index, seed] of SAMPLE_SEEDS.slice(0, profile.samples).entries()) {
    const before = { ...state, seed }
    const after = applyMove(before, move)

    if (after === before) {
      return null
    }

    total += scoreState(after, player, enemies, profile)

    // Where the stacks end up hardly depends on the rolls, so the board is read once to save time.
    if (index === 0) {
      tactics = tacticalScore(after, player, profile)
    }
  }

  return total / profile.samples + tactics
}

/** Every move that ends the active stack's turn: attacks, moves and defend. */
export function actionMoves(state: GameState): Move[] {
  const actor = activeUnit(state)

  if (!actor) {
    return []
  }

  const moves: Move[] = [{ type: 'defend' }]

  for (const target of state.units) {
    const mode = attackMode(state, actor, target)

    if (mode === 'shoot') {
      moves.push({ type: 'attack', targetId: target.id })
    } else if (mode === 'melee') {
      for (const from of attackOrigins(state, actor, target)) {
        moves.push({ type: 'attack', targetId: target.id, from })
      }
    }
  }

  for (const path of reachableHexes(state, actor).values()) {
    moves.push({ type: 'move', to: path[path.length - 1] })
  }

  return moves
}

/** Every spell the active player's hero could cast right now. */
export function spellMoves(state: GameState): Move[] {
  const actor = activeUnit(state)

  if (!actor) {
    return []
  }

  return state.heroes[actor.owner].spells.flatMap((spell): Move[] => {
    if (SPELLS[spell].target === 'everyone') {
      return castProblem(state, spell) === null ? [{ type: 'cast', spell }] : []
    }

    return state.units
      .filter((unit) => castProblem(state, spell, unit.id) === null)
      .map((unit) => ({ type: 'cast', spell, targetId: unit.id }))
  })
}

interface Scored {
  move: Move
  score: number
}

/** The best move, or with `choices` above 1 a random one of the best few. A winning move is always taken. */
function bestOf(state: GameState, moves: Move[], player: Player, profile: Profile): Scored | null {
  const scored: Scored[] = []

  for (const move of moves) {
    const score = scoreMove(state, move, player, profile)

    if (score !== null) {
      scored.push({ move, score })
    }
  }

  if (scored.length === 0) {
    return null
  }

  scored.sort((first, second) => second.score - first.score)

  if (profile.choices <= 1 || scored[0].score >= WIN_SCORE) {
    return scored[0]
  }

  // Derived from the battle's seed without advancing it, so the battle stays replayable.
  const random = createRandom(state.seed ^ 0x3c6ef372)

  return scored[random.integer(0, Math.min(profile.choices, scored.length) - 1)]
}

/**
 * The computer's next move for the active stack. It may be a spell, which does not end
 * the turn: call again afterwards for the stack's action.
 */
export function chooseMove(state: GameState, difficulty: Difficulty = 'normal'): Move {
  const actor = activeUnit(state)

  if (!actor) {
    return { type: 'defend' }
  }

  const player = actor.owner
  const profile = PROFILES[difficulty]

  if (shouldRetreat(state, player)) {
    return { type: 'retreat' }
  }

  const now = scoreState(state, player, enemiesOf(state, player), profile) + tacticalScore(state, player, profile)

  if (profile.castsSpells) {
    const bestSpell = bestOf(state, spellMoves(state), player, profile)

    if (bestSpell && bestSpell.score > now) {
      return bestSpell.move
    }
  }

  const best = bestOf(state, actionMoves(state), player, profile) ?? { move: { type: 'defend' }, score: now }

  if (profile.waits && shouldWait(state, actor, best.move)) {
    // An Expert only waits when nothing urgent is on: no stack to shield and no blow to dodge.
    if (profile.threatWeight === 0 || best.score - now < WAIT_MARGIN * stackValue(actor)) {
      return { type: 'wait' }
    }
  }

  return best.move
}
