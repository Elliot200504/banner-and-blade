import { CREATURES, FACTIONS, hasAbility, type Faction } from './creatures'
import { createHero, HEROES, heroesOf, type Hero, type HeroId } from './heroes'
import { COLUMNS, hexKey, offsetToHex, ROWS } from './hex'
import { createRandom, type Random } from './random'
import { buildQueue } from './rules'
import type { GameState, Obstacle, ObstacleKind, Player, Unit } from './types'
import { PLAYER_NAMES } from './types'

/** Rows the six stacks of an army start on, top to bottom. */
const START_ROWS = [0, 2, 4, 6, 8, 10]
/** Each half of the field looks like home for the army that starts there. */
const OBSTACLES_BY_FACTION: Record<Faction, ObstacleKind[]> = {
  order: ['tree', 'rock'],
  undead: ['deadTree', 'tombstone'],
  dungeon: ['stalagmite', 'crystal'],
}
const OBSTACLE_PAIRS = 4

function createArmy(owner: Player, faction: Faction, hero: Hero): Unit[] {
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
      lostTurn: false,
      specialty: hero.specialty.kind === 'creature' && hero.specialty.creature === type,
      effects: [],
    }
  })
}

/**
 * Obstacles in the middle of the field, mirrored so neither side is favored.
 * Red's half gets obstacles from Red's homeland, Blue's half from Blue's.
 */
function createObstacles(random: Random, factions: Record<Player, Faction>): Obstacle[] {
  const obstacles: Obstacle[] = []
  const taken = new Set<string>()
  let attempts = 0
  while (obstacles.length < OBSTACLE_PAIRS * 2 && attempts < 100) {
    attempts++
    const column = random.integer(3, Math.floor(COLUMNS / 2))
    const row = random.integer(0, ROWS - 1)
    const variant = random.integer(0, 1)
    const first = offsetToHex(column, row)
    const mirrored = offsetToHex(COLUMNS - 1 - column, ROWS - 1 - row)
    if (taken.has(hexKey(first)) || taken.has(hexKey(mirrored))) continue
    taken.add(hexKey(first))
    taken.add(hexKey(mirrored))
    obstacles.push({ position: first, kind: OBSTACLES_BY_FACTION[factions.red][variant] })
    if (hexKey(first) !== hexKey(mirrored)) {
      obstacles.push({ position: mirrored, kind: OBSTACLES_BY_FACTION[factions.blue][variant] })
    }
  }
  return obstacles
}

/** Leads with the chosen hero, or the faction's first hero if none (or one of another faction) is chosen. */
function heroFor(faction: Faction, chosen: HeroId | undefined): Hero {
  return createHero(chosen && HEROES[chosen].faction === faction ? chosen : heroesOf(faction)[0])
}

export function createBattle(
  factions: Record<Player, Faction>,
  seed: number,
  chosenHeroes: Partial<Record<Player, HeroId>> = {},
): GameState {
  const random = createRandom(seed)
  const heroes = { red: heroFor(factions.red, chosenHeroes.red), blue: heroFor(factions.blue, chosenHeroes.blue) }
  const units = [...createArmy('red', factions.red, heroes.red), ...createArmy('blue', factions.blue, heroes.blue)]
  return {
    units,
    heroes,
    factions,
    obstacles: createObstacles(random, factions),
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
