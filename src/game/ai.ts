import { effectiveSpeed, totalHp } from './combat'
import { CREATURES } from './creatures'
import { hexDistance, type Hex } from './hex'
import { attackMode, attackOrigins, isEnemyAdjacent, reachableHexes } from './movement'
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
/** How much an active effect changes a stack's worth, at full strength. */
const EFFECT_WEIGHT: Record<EffectId, number> = { haste: 0.15, bless: 0.2, stoneSkin: 0.15, slow: -0.2, curse: -0.2 }

export type Difficulty = 'easy' | 'normal' | 'hard'

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard']

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
  /** Picks at random among this many of the best moves. */
  choices: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { samples: 1, aggression: 1.2, distancePenalty: 0.02, castsSpells: false, choices: 3 },
  normal: { samples: 3, aggression: 1.2, distancePenalty: 0.02, castsSpells: true, choices: 1 },
  hard: { samples: 8, aggression: 1.5, distancePenalty: 0.03, castsSpells: true, choices: 1 },
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
  for (const active of unit.effects) value *= 1 + EFFECT_WEIGHT[active.effect] * Math.min(1, active.roundsLeft / 2)
  if (unit.petrified) value *= unit.lostTurn ? 0.9 : 0.8
  return value
}

const aggression = (profile: Profile, round: number) =>
  profile.aggression + AGGRESSION_PER_ROUND * Math.max(0, round - PATIENT_ROUNDS)

/**
 * How good the state is for `player`: their army minus the enemy's, plus position and mana.
 * Distances are measured to `enemyPositions`, where the enemies stood before the move, so that
 * killing the nearest stack never looks like losing ground.
 */
export function scoreState(
  state: GameState,
  player: Player,
  enemyPositions: Hex[],
  profile: Profile = PROFILES.normal,
): number {
  if (state.winner) return state.winner === player ? WIN_SCORE : -WIN_SCORE
  let score = MANA_VALUE * state.heroes[player].mana
  for (const unit of state.units) {
    const value = stackValue(unit)
    if (unit.owner !== player) {
      score -= aggression(profile, state.round) * value
      continue
    }
    score += value
    const nearest = Math.min(...enemyPositions.map((position) => hexDistance(unit.position, position)))
    const reach = isShooter(unit) ? CREATURES[unit.type].range : 1 + effectiveSpeed(unit)
    score -= profile.distancePenalty * value * Math.max(0, nearest - reach)
    if (isShooter(unit) && isEnemyAdjacent(state.units, unit)) score -= BLOCKED_PENALTY * value
  }
  return score
}

const enemyPositionsOf = (state: GameState, player: Player): Hex[] =>
  state.units.filter((unit) => unit.owner !== player).map((unit) => unit.position)

/** The average score of a move over the AI's imagined rolls, or null if the move is not allowed. */
function scoreMove(state: GameState, move: Move, player: Player, profile: Profile): number | null {
  const enemyPositions = enemyPositionsOf(state, player)
  let total = 0
  for (const seed of SAMPLE_SEEDS.slice(0, profile.samples)) {
    const before = { ...state, seed }
    const after = applyMove(before, move)
    if (after === before) return null
    total += scoreState(after, player, enemyPositions, profile)
  }
  return total / profile.samples
}

/** Every move that ends the active stack's turn: attacks, moves and defend. */
export function actionMoves(state: GameState): Move[] {
  const actor = activeUnit(state)
  if (!actor) return []
  const moves: Move[] = [{ type: 'defend' }]
  for (const target of state.units) {
    const mode = attackMode(state, actor, target)
    if (mode === 'shoot') moves.push({ type: 'attack', targetId: target.id })
    else if (mode === 'melee') {
      for (const from of attackOrigins(state, actor, target)) moves.push({ type: 'attack', targetId: target.id, from })
    }
  }
  for (const path of reachableHexes(state, actor).values()) moves.push({ type: 'move', to: path[path.length - 1] })
  return moves
}

/** Every spell the active player's hero could cast right now. */
export function spellMoves(state: GameState): Move[] {
  const actor = activeUnit(state)
  if (!actor) return []
  return state.heroes[actor.owner].spells.flatMap((spell): Move[] => {
    if (SPELLS[spell].target === 'everyone') return castProblem(state, spell) === null ? [{ type: 'cast', spell }] : []
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
    if (score !== null) scored.push({ move, score })
  }
  if (scored.length === 0) return null
  scored.sort((first, second) => second.score - first.score)
  if (profile.choices <= 1 || scored[0].score >= WIN_SCORE) return scored[0]
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
  if (!actor) return { type: 'defend' }
  const player = actor.owner
  const profile = PROFILES[difficulty]

  if (profile.castsSpells) {
    const bestSpell = bestOf(state, spellMoves(state), player, profile)
    const now = scoreState(state, player, enemyPositionsOf(state, player), profile)
    if (bestSpell && bestSpell.score > now) return bestSpell.move
  }

  return bestOf(state, actionMoves(state), player, profile)?.move ?? { type: 'defend' }
}
