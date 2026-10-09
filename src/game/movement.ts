import { effectiveSpeed } from './combat'
import { CREATURES, hasAbility } from './creatures'
import { allHexes, hexDistance, hexKey, inBounds, neighbors, sameHex, type Hex } from './hex'
import type { GameState, Unit } from './types'

type Board = Pick<GameState, 'units' | 'obstacles'>

export function unitAt(units: Unit[], hex: Hex): Unit | undefined {
  return units.find((unit) => sameHex(unit.position, hex))
}

function isBlocked(board: Board, hex: Hex): boolean {
  return (
    !inBounds(hex) ||
    board.obstacles.some((obstacle) => sameHex(obstacle.position, hex)) ||
    board.units.some((unit) => sameHex(unit.position, hex))
  )
}

/**
 * Every hex the unit can move to, keyed by hexKey, with the path there (start included).
 * Walkers go around units and obstacles; flyers go straight over them.
 */
export function reachableHexes(board: Board, unit: Unit): Map<string, Hex[]> {
  const speed = effectiveSpeed(unit)
  const paths = new Map<string, Hex[]>()

  if (hasAbility(unit.type, 'flying')) {
    for (const hex of allHexes()) {
      const distance = hexDistance(unit.position, hex)

      if (distance > 0 && distance <= speed && !isBlocked(board, hex)) {
        paths.set(hexKey(hex), [unit.position, hex])
      }
    }

    return paths
  }

  const visited = new Set([hexKey(unit.position)])
  let frontier: Hex[][] = [[unit.position]]

  for (let step = 0; step < speed; step++) {
    const nextFrontier: Hex[][] = []

    for (const path of frontier) {
      for (const neighbor of neighbors(path[path.length - 1])) {
        const key = hexKey(neighbor)

        if (visited.has(key) || isBlocked(board, neighbor)) {
          continue
        }

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

/** How many hexes a path covers. Walking paths list every hex; flying paths are just start and end. */
export function pathLength(path: Hex[]): number {
  if (path.length < 2) {
    return 0
  }

  return path.length === 2 ? hexDistance(path[0], path[1]) : path.length - 1
}

export function isEnemyAdjacent(units: Unit[], unit: Unit): boolean {
  return units.some((other) => other.owner !== unit.owner && hexDistance(other.position, unit.position) === 1)
}

/** Hexes the unit can strike the target from in melee: where it stands, or any reachable hex next to the target. */
export function attackOrigins(board: Board, unit: Unit, target: Unit): Hex[] {
  const origins: Hex[] = []

  if (hexDistance(unit.position, target.position) === 1) {
    origins.push(unit.position)
  }

  const reach = reachableHexes(board, unit)

  for (const neighbor of neighbors(target.position)) {
    if (reach.has(hexKey(neighbor))) {
      origins.push(neighbor)
    }
  }

  return origins
}

export type ShotProblem = 'noRangedAttack' | 'noShots' | 'blocked' | 'outOfRange'

/** Why the unit can't shoot the target right now, or null if it can. */
export function shotProblem(units: Unit[], unit: Unit, target: Unit): ShotProblem | null {
  const stats = CREATURES[unit.type]

  if (stats.range === 0) {
    return 'noRangedAttack'
  }

  if (unit.shots <= 0) {
    return 'noShots'
  }

  if (isEnemyAdjacent(units, unit)) {
    return 'blocked'
  }

  if (hexDistance(unit.position, target.position) > stats.range) {
    return 'outOfRange'
  }

  return null
}

export type AttackMode = 'shoot' | 'melee'

/** How the unit would attack the target, or null if it can't reach it at all. */
export function attackMode(board: Board, unit: Unit, target: Unit): AttackMode | null {
  if (target.owner === unit.owner) {
    return null
  }

  if (shotProblem(board.units, unit, target) === null) {
    return 'shoot'
  }

  return attackOrigins(board, unit, target).length > 0 ? 'melee' : null
}
