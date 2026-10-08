import { hexDistance, hexKey, inBounds, neighbors, sameHex, type Hex } from './hex'
import { UNIT_STATS } from './units'
import type { BattleEvent, GameState, Move, Player, Unit } from './types'
import { PLAYER_NAMES } from './types'

const MAX_LOG = 60
/** Damage multiplier for a unit that is defending. */
export const DEFEND_FACTOR = 0.7
/** Damage multiplier for an archer shooting with an enemy next to it. */
export const OBSTRUCTED_FACTOR = 0.5

type Board = Pick<GameState, 'units' | 'obstacles'>

export function activeUnit(state: GameState): Unit | undefined {
  return state.units.find((unit) => unit.id === state.queue[0])
}

export function unitAt(units: Unit[], hex: Hex): Unit | undefined {
  return units.find((unit) => sameHex(unit.position, hex))
}

function isBlocked(board: Board, hex: Hex): boolean {
  return (
    !inBounds(hex) ||
    board.obstacles.some((obstacle) => sameHex(obstacle, hex)) ||
    board.units.some((unit) => sameHex(unit.position, hex))
  )
}

/** Every hex the unit can walk to, keyed by hexKey, with the path there (start included). */
export function reachableHexes(board: Board, unit: Unit): Map<string, Hex[]> {
  const paths = new Map<string, Hex[]>()
  const visited = new Set([hexKey(unit.position)])
  let frontier: Hex[][] = [[unit.position]]
  for (let step = 0; step < UNIT_STATS[unit.type].move; step++) {
    const nextFrontier: Hex[][] = []
    for (const path of frontier) {
      for (const neighbor of neighbors(path[path.length - 1])) {
        const key = hexKey(neighbor)
        if (visited.has(key) || isBlocked(board, neighbor)) continue
        visited.add(key)
        const newPath = [...path, neighbor]
        paths.set(key, newPath)
        nextFrontier.push(newPath)
      }
    }
    frontier = nextFrontier
  }
  return paths
}

export function isEnemyAdjacent(units: Unit[], unit: Unit): boolean {
  return units.some((other) => other.owner !== unit.owner && hexDistance(other.position, unit.position) === 1)
}

/** Hexes a melee unit can strike the target from: where it stands, or any reachable hex next to the target. */
export function attackOrigins(board: Board, unit: Unit, target: Unit): Hex[] {
  if (UNIT_STATS[unit.type].ranged) return []
  const origins: Hex[] = []
  if (hexDistance(unit.position, target.position) === 1) origins.push(unit.position)
  const reach = reachableHexes(board, unit)
  for (const neighbor of neighbors(target.position)) {
    if (reach.has(hexKey(neighbor))) origins.push(neighbor)
  }
  return origins
}

export function canAttack(board: Board, unit: Unit, target: Unit): boolean {
  if (target.owner === unit.owner) return false
  return UNIT_STATS[unit.type].ranged || attackOrigins(board, unit, target).length > 0
}

export function damageFor(units: Unit[], attacker: Unit, target: Unit): number {
  const stats = UNIT_STATS[attacker.type]
  let damage = stats.damage
  if (stats.ranged && isEnemyAdjacent(units, attacker)) damage *= OBSTRUCTED_FACTOR
  if (target.defending) damage *= DEFEND_FACTOR
  return Math.max(1, Math.floor(damage))
}

/**
 * Turn order for a round: higher initiative first. Units with equal initiative
 * alternate between the sides, and the side that goes first swaps each round.
 */
export function buildQueue(units: Unit[], round: number): string[] {
  const firstPlayer: Player = round % 2 === 1 ? 'red' : 'blue'
  const initiatives = [...new Set(units.map((unit) => UNIT_STATS[unit.type].initiative))].sort(
    (higher, lower) => lower - higher,
  )
  const queue: string[] = []
  for (const initiative of initiatives) {
    const group = units.filter((unit) => UNIT_STATS[unit.type].initiative === initiative)
    const firstSide = group.filter((unit) => unit.owner === firstPlayer)
    const secondSide = group.filter((unit) => unit.owner !== firstPlayer)
    for (let index = 0; index < Math.max(firstSide.length, secondSide.length); index++) {
      if (firstSide[index]) queue.push(firstSide[index].id)
      if (secondSide[index]) queue.push(secondSide[index].id)
    }
  }
  return queue
}

function winnerOf(units: Unit[]): Player | null {
  if (!units.some((unit) => unit.owner === 'blue')) return 'red'
  if (!units.some((unit) => unit.owner === 'red')) return 'blue'
  return null
}

/** Applies the active unit's move. Returns the same state object if the move is not allowed. */
export function applyMove(state: GameState, move: Move): GameState {
  const actor = activeUnit(state)
  if (state.winner || !actor) return state

  let units = state.units.map((unit) => (unit.id === actor.id ? { ...unit, defending: false } : unit))
  const events: BattleEvent[] = []
  const log: string[] = []
  const getUnit = (id: string) => units.find((unit) => unit.id === id)!
  const updateUnit = (id: string, changes: Partial<Unit>) => {
    units = units.map((unit) => (unit.id === id ? { ...unit, ...changes } : unit))
  }

  const walkTo = (destination: Hex): boolean => {
    const path = reachableHexes({ units, obstacles: state.obstacles }, getUnit(actor.id)).get(hexKey(destination))
    if (!path) return false
    updateUnit(actor.id, { position: destination })
    events.push({ kind: 'move', unitId: actor.id, path })
    log.push(`${actor.label} moves.`)
    return true
  }

  const strike = (attackerId: string, targetId: string, retaliation: boolean) => {
    const attacker = getUnit(attackerId)
    const target = getUnit(targetId)
    const ranged = UNIT_STATS[attacker.type].ranged && !retaliation
    const damage = damageFor(units, attacker, target)
    const targetHp = Math.max(0, target.hp - damage)
    updateUnit(targetId, { hp: targetHp })
    events.push({ kind: 'attack', attackerId, targetId, damage, ranged, retaliation, targetHp })
    const verb = retaliation ? 'strikes back at' : ranged ? 'shoots' : 'attacks'
    log.push(`${attacker.label} ${verb} ${target.label} for ${damage}.`)
    if (targetHp === 0) {
      events.push({ kind: 'death', unitId: targetId })
      log.push(`${target.label} perishes!`)
    }
  }

  switch (move.type) {
    case 'move':
      if (!walkTo(move.to)) return state
      break
    case 'defend':
      updateUnit(actor.id, { defending: true })
      events.push({ kind: 'defend', unitId: actor.id })
      log.push(`${actor.label} defends.`)
      break
    case 'attack': {
      const target = state.units.find((unit) => unit.id === move.targetId)
      if (!target || !canAttack(state, actor, target)) return state
      const melee = !UNIT_STATS[actor.type].ranged
      if (melee) {
        const from = move.from ?? actor.position
        if (hexDistance(from, target.position) !== 1) return state
        if (!sameHex(from, actor.position) && !walkTo(from)) return state
      }
      strike(actor.id, target.id, false)
      const victim = getUnit(target.id)
      if (melee && victim.hp > 0 && !victim.retaliated) {
        updateUnit(victim.id, { retaliated: true })
        strike(victim.id, actor.id, true)
      }
      break
    }
  }

  units = units.filter((unit) => unit.hp > 0)
  let queue = state.queue.slice(1).filter((id) => units.some((unit) => unit.id === id))
  let round = state.round
  const winner = winnerOf(units)
  if (winner) {
    log.push(`${PLAYER_NAMES[winner]} wins the battle!`)
  } else if (queue.length === 0) {
    round++
    units = units.map((unit) => ({ ...unit, retaliated: false }))
    queue = buildQueue(units, round)
    log.push(`— Round ${round} —`)
  }

  return { ...state, units, queue, round, winner, events, log: [...state.log, ...log].slice(-MAX_LOG) }
}
