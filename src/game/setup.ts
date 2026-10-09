import { armyProblem, standardArmy, type Army } from './army'
import { baseOf, CREATURES, hasAbility, isWarMachine, type Faction, type WarMachine } from './creatures'
import { createHero, HEROES, heroesOf, type Hero, type HeroId } from './heroes'
import { COLUMNS, hexKey, offsetToHex, ROWS } from './hex'
import { createRandom, type Random } from './random'
import { buildQueue } from './rules'
import type { GameState, Obstacle, ObstacleKind, Player, Unit } from './types'
import { PLAYER_NAMES } from './types'

/** Each half of the field looks like home for the army that starts there. */
export const OBSTACLES_BY_FACTION: Record<Faction, ObstacleKind[]> = {
  castle: ['tree', 'rock'],
  rampart: ['oak', 'mushroom'],
  stronghold: ['boulder', 'totem'],
  necropolis: ['deadTree', 'tombstone'],
  dungeon: ['stalagmite', 'crystal'],
  inferno: ['lavaRock', 'fireVent'],
  tower: ['snowPine', 'iceRock'],
  fortress: ['reeds', 'swampLog'],
  conflux: ['runestone', 'elementalShard'],
}
const OBSTACLE_PAIRS = 4

/** War machines stand at the ends of the back line. */
const MACHINE_ROWS: Record<WarMachine, number> = { ballista: 0, ammoCart: 1, firstAidTent: ROWS - 1 }

/**
 * The row each of `stacks` stacks starts on, spread evenly down the rows the war machines leave free.
 * With no machines, six stacks get rows 0, 2, 4, 6, 8 and 10.
 */
function startRow(index: number, stacks: number, freeRows: number[]): number {
  return freeRows[Math.round(((index + 0.5) * freeRows.length) / stacks - 0.5)]
}

function createArmy(owner: Player, army: Army, hero: Hero): Unit[] {
  const column = owner === 'red' ? 0 : COLUMNS - 1
  const creatures = army.filter((stack) => !isWarMachine(stack.type))
  const machineRows = army.flatMap((stack) => (isWarMachine(stack.type) ? [MACHINE_ROWS[stack.type]] : []))
  const freeRows = Array.from({ length: ROWS }, (_, row) => row).filter((row) => !machineRows.includes(row))
  const rowOf = (type: Army[number]['type']) =>
    isWarMachine(type) ? MACHINE_ROWS[type] : startRow(creatures.findIndex((stack) => stack.type === type), creatures.length, freeRows)

  return army.map(({ type, count }) => {
    const stats = CREATURES[type]

    return {
      id: `${owner}-${type}`,
      label: `${PLAYER_NAMES[owner]} ${stats.plural}`,
      type,
      owner,
      position: offsetToHex(column, rowOf(type)),
      count,
      startCount: count,
      topHp: stats.hp,
      shots: stats.shots,
      retaliationsLeft: hasAbility(type, 'doubleRetaliation') ? 2 : 1,
      defending: false,
      waited: false,
      hadMoraleTurn: false,
      petrified: false,
      lostTurn: false,
      // A specialist leads the upgraded creature as well.
      specialty: hero.specialty.kind === 'creature' && hero.specialty.creature === baseOf(type),
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

    if (taken.has(hexKey(first)) || taken.has(hexKey(mirrored))) {
      continue
    }

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

/** The recruited army, or the faction's standard army if none (or one that breaks the rules) is given. */
function armyFor(faction: Faction, recruited: Army | undefined): Army {
  if (!recruited || armyProblem(recruited, faction)) {
    return standardArmy(faction)
  }

  return recruited.filter((stack) => stack.count > 0)
}

export function createBattle(
  factions: Record<Player, Faction>,
  seed: number,
  chosenHeroes: Partial<Record<Player, HeroId>> = {},
  armies: Partial<Record<Player, Army>> = {},
): GameState {
  const random = createRandom(seed)
  const heroes = { red: heroFor(factions.red, chosenHeroes.red), blue: heroFor(factions.blue, chosenHeroes.blue) }
  const units = [
    ...createArmy('red', armyFor(factions.red, armies.red), heroes.red),
    ...createArmy('blue', armyFor(factions.blue, armies.blue), heroes.blue),
  ]

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
