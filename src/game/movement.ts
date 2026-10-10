import { effectiveSpeed } from './combat'
import { CREATURES, hasAbility, isWarMachine } from './creatures'
import { allHexes, hexDistance, hexKey, inBounds, neighbors, sameHex, type Hex } from './hex'
import type { CreatureType } from './creatures'
import type { GameState, Player, Unit } from './types'

type Board = Pick<GameState, 'units' | 'obstacles'>

/**
 * The hexes a stack stands on with its front on `head`. Wide creatures, like dragons and cavalry, also take
 * the hex behind them: to the left for Red, to the right for Blue, facing the enemy.
 */
export function footprint(type: CreatureType, owner: Player, head: Hex): Hex[] {
  return hasAbility(type, 'wide') ? [head, { q: head.q + (owner === 'red' ? -1 : 1), r: head.r }] : [head]
}

export const hexesOf = (unit: Unit): Hex[] => footprint(unit.type, unit.owner, unit.position)

export const occupies = (unit: Unit, hex: Hex): boolean => hexesOf(unit).some((own) => sameHex(own, hex))

/** The fewest steps between any hex of one footprint and any hex of the other. */
function footprintDistance(first: Hex[], second: Hex[]): number {
  return Math.min(...first.flatMap((from) => second.map((to) => hexDistance(from, to))))
}

/** How far apart two stacks stand, counting from their nearest hexes. 1 means they are side by side. */
export const unitDistance = (first: Unit, second: Unit): number => footprintDistance(hexesOf(first), hexesOf(second))

export function unitAt(units: Unit[], hex: Hex): Unit | undefined {
  return units.find((unit) => occupies(unit, hex))
}

/** Whether the hex is off the board, an obstacle, or taken by a stack other than `moverId`. */
function isBlocked(board: Board, hex: Hex, moverId?: string): boolean {
  return (
    !inBounds(hex) ||
    board.obstacles.some((obstacle) => sameHex(obstacle.position, hex)) ||
    board.units.some((unit) => unit.id !== moverId && occupies(unit, hex))
  )
}

/** Whether the unit would fit with its front on `head`, every hex it takes free. */
function fits(board: Board, unit: Unit, head: Hex): boolean {
  return footprint(unit.type, unit.owner, head).every((hex) => !isBlocked(board, hex, unit.id))
}

/**
 * Every hex the unit can move to, keyed by hexKey, with the path there (start included).
 * Walkers go around units and obstacles; flyers go straight over them.
 */
export function reachableHexes(board: Board, unit: Unit): Map<string, Hex[]> {
  const speed = effectiveSpeed(unit)
  const paths = new Map<string, Hex[]>()

  if (isWarMachine(unit.type)) {
    return paths
  }

  if (hasAbility(unit.type, 'flying')) {
    for (const hex of allHexes()) {
      const distance = hexDistance(unit.position, hex)

      if (distance > 0 && distance <= speed && fits(board, unit, hex)) {
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

        if (visited.has(key) || !fits(board, unit, neighbor)) {
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
  return units.some((other) => other.owner !== unit.owner && unitDistance(other, unit) === 1)
}

/** Whether the unit, standing with its front on `head`, would be right next to the target. */
export function strikesFrom(unit: Unit, head: Hex, target: Unit): boolean {
  return footprintDistance(footprint(unit.type, unit.owner, head), hexesOf(target)) === 1
}

/** Where the unit can strike the target from in melee: where it stands, or anywhere it can reach next to the target. */
export function attackOrigins(board: Board, unit: Unit, target: Unit): Hex[] {
  const origins: Hex[] = []

  if (strikesFrom(unit, unit.position, target)) {
    origins.push(unit.position)
  }

  for (const path of reachableHexes(board, unit).values()) {
    const head = path[path.length - 1]

    if (strikesFrom(unit, head, target)) {
      origins.push(head)
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

  // A war machine shoots even with an enemy right next to it.
  if (isEnemyAdjacent(units, unit) && !isWarMachine(unit.type)) {
    return 'blocked'
  }

  if (unitDistance(unit, target) > stats.range) {
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

  if (isWarMachine(unit.type)) {
    return null
  }

  return attackOrigins(board, unit, target).length > 0 ? 'melee' : null
}
