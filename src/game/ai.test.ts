import { describe, expect, it } from 'vitest'
import { applyMove, chooseMove, createBattle, createHero, CREATURES, offsetToHex, type Difficulty, type Faction, type GameState, type Unit } from './index'

function makeUnit(type: Unit['type'], owner: Unit['owner'], column: number, row: number, changes: Partial<Unit> = {}): Unit {
  const stats = CREATURES[type]

  return {
    id: `${owner}-${type}`, label: `${owner} ${stats.plural}`, type, owner, position: offsetToHex(column, row),
    count: stats.armyCount, startCount: stats.armyCount, topHp: stats.hp, shots: stats.shots, retaliationsLeft: 1, defending: false,
    waited: false, hadMoraleTurn: false, petrified: false, lostTurn: false, specialty: false, effects: [], ...changes,
  }
}

function battle(units: Unit[]): GameState {
  const hero = { ...createHero('tyris'), morale: 0, luck: 0, mana: 0 }

  return { ...createBattle({ red: 'castle', blue: 'necropolis' }, 1), units, obstacles: [], queue: units.map((unit) => unit.id), heroes: { red: hero, blue: hero } }
}

/** Plays a whole battle with the computer on both sides. */
function playOut(state: GameState, difficulty: Difficulty = 'normal', maxMoves = 2000): { state: GameState; moves: number } {
  let moves = 0

  while (!state.winner && moves < maxMoves) {
    const next = applyMove(state, chooseMove(state, difficulty))
    expect(next).not.toBe(state)
    state = next
    moves++
  }

  return { state, moves }
}

describe('computer player', () => {
  it('finishes off a stack it can kill', () => {
    const cavaliers = makeUnit('cavalier', 'red', 0, 0)
    const weak = makeUnit('skeleton', 'blue', 3, 0, { count: 1 })
    const strong = makeUnit('blackKnight', 'blue', 3, 4, { id: 'blue-strong' })
    expect(chooseMove(battle([cavaliers, weak, strong]))).toMatchObject({ type: 'attack' })
  })

  it('shooters shoot instead of walking into melee', () => {
    const archers = makeUnit('archer', 'red', 0, 0)
    const walkingDead = makeUnit('walkingDead', 'blue', 5, 0)
    expect(chooseMove(battle([archers, walkingDead]))).toEqual({ type: 'attack', targetId: walkingDead.id })
  })

  it('walks toward the enemy when nothing is in reach', () => {
    const state = battle([makeUnit('swordsman', 'red', 0, 5), makeUnit('walkingDead', 'blue', 14, 5)])
    expect(chooseMove(state)).toMatchObject({ type: 'move' })
  })

  const matchups: [Faction, Faction][] = [
    ['castle', 'necropolis'],
    ['necropolis', 'dungeon'],
    ['dungeon', 'castle'],
  ]

  for (const [red, blue] of matchups) {
    it(`plays a full ${red} vs ${blue} battle to the end`, { timeout: 30_000 }, () => {
      const { state } = playOut(createBattle({ red, blue }, 123))
      expect(state.winner).not.toBeNull()
    })
  }

  it('on Easy never casts spells', () => {
    let state = createBattle({ red: 'dungeon', blue: 'castle' }, 9, { red: 'deemer', blue: 'adela' })

    for (let moves = 0; moves < 200 && !state.winner; moves++) {
      const move = chooseMove(state, 'easy')
      expect(move.type).not.toBe('cast')
      state = applyMove(state, move)
    }
  })

  it('on Easy still finishes off a stack when that wins the battle', () => {
    const cavaliers = makeUnit('cavalier', 'red', 0, 0)
    const last = makeUnit('skeleton', 'blue', 3, 0, { count: 1 })
    expect(chooseMove(battle([cavaliers, last]), 'easy')).toMatchObject({ type: 'attack', targetId: last.id })
  })

  for (const difficulty of ['easy', 'hard'] as const) {
    it(`plays a full battle to the end on ${difficulty}`, { timeout: 60_000 }, () => {
      const { state } = playOut(createBattle({ red: 'necropolis', blue: 'dungeon' }, 77), difficulty)
      expect(state.winner).not.toBeNull()
    })
  }
})
