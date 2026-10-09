import { CREATURES, FACTIONS, hasAbility, type Faction } from './creatures'
import { createHero } from './heroes'
import { COLUMNS, hexKey, offsetToHex, ROWS } from './hex'
import { createRandom, type Random } from './random'
import { buildQueue } from './rules'
import type { GameState, Obstacle, ObstacleKind, Player, Unit } from './types'
import { PLAYER_NAMES } from './types'

/** Rows the six stacks of an army start on, top to bottom. */
const START_ROWS = [0, 2, 4, 6, 8, 10]
const OBSTACLE_KINDS: ObstacleKind[] = ['rock', 'tree', 'deadTree']
const OBSTACLE_PAIRS = 4

function createArmy(owner: Player, faction: Faction): Unit[] {
  const column = owner === 'red' ? 0 : COLUMNS - 1
  return FACTIONS[faction].creatures.map((type, index) => {
    const stats = CREATURES[type]
    return {
      id: `${owner}-${type}`,
      label: `${PLAYER_NAMES[owner]} ${stats.plural}`,
      type,
      owner,
      position: offsetToHex(column, START_ROWS[index]),
      count: stats.armyCount,
      topHp: stats.hp,
      shots: stats.shots,
      retaliationsLeft: hasAbility(type, 'doubleRetaliation') ? 2 : 1,
      defending: false,
      waited: false,
      hadMoraleTurn: false,
      petrified: false,
      effects: [],
    }
  })
}

/** Obstacles in the middle of the field, mirrored so neither side is favored. */
function createObstacles(random: Random): Obstacle[] {
  const obstacles: Obstacle[] = []
  const taken = new Set<string>()
  let attempts = 0
  while (obstacles.length < OBSTACLE_PAIRS * 2 && attempts < 100) {
    attempts++
    const column = random.integer(3, Math.floor(COLUMNS / 2))
    const row = random.integer(0, ROWS - 1)
    const kind = OBSTACLE_KINDS[random.integer(0, OBSTACLE_KINDS.length - 1)]
    const first = offsetToHex(column, row)
    const mirrored = offsetToHex(COLUMNS - 1 - column, ROWS - 1 - row)
    if (taken.has(hexKey(first)) || taken.has(hexKey(mirrored))) continue
    taken.add(hexKey(first))
    taken.add(hexKey(mirrored))
    obstacles.push({ position: first, kind })
    if (hexKey(first) !== hexKey(mirrored)) obstacles.push({ position: mirrored, kind })
  }
  return obstacles
}

export function createBattle(factions: Record<Player, Faction>, seed: number): GameState {
  const random = createRandom(seed)
  const units = [...createArmy('red', factions.red), ...createArmy('blue', factions.blue)]
  return {
    units,
    heroes: { red: createHero(factions.red), blue: createHero(factions.blue) },
    factions,
    obstacles: createObstacles(random),
    round: 1,
    queue: buildQueue(units, 1),
    winner: null,
    retreated: null,
    casualties: { red: {}, blue: {} },
    log: ['— Round 1 —'],
    events: [],
    seed: random.seed(),
  }
}
