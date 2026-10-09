import { describe, expect, it } from 'vitest'
import { applyMove, chooseMove, createBattle, createHero, CREATURES, offsetToHex, type Faction, type GameState, type Unit } from './index'

function makeUnit(type: Unit['type'], owner: Unit['owner'], column: number, row: number, changes: Partial<Unit> = {}): Unit {
  const stats = CREATURES[type]
  return {
    id: `${owner}-${type}`, label: `${owner} ${stats.plural}`, type, owner, position: offsetToHex(column, row),
    count: stats.armyCount, topHp: stats.hp, shots: stats.shots, retaliationsLeft: 1, defending: false,
    waited: false, hadMoraleTurn: false, petrified: false, lostTurn: false, specialty: false, effects: [], ...changes,
  }
}

function battle(units: Unit[]): GameState {
  const hero = { ...createHero('tyris'), morale: 0, luck: 0, mana: 0 }
  return { ...createBattle({ red: 'order', blue: 'undead' }, 1), units, obstacles: [], queue: units.map((unit) => unit.id), heroes: { red: hero, blue: hero } }
}

/** Plays a whole battle with the computer on both sides. */
function playOut(state: GameState, maxMoves = 2000): { state: GameState; moves: number } {
  let moves = 0
  while (!state.winner && moves < maxMoves) {
    const next = applyMove(state, chooseMove(state))
    expect(next).not.toBe(state)
    state = next
    moves++
  }
  return { state, moves }
}

describe('computer player', () => {
  it('finishes off a stack it can kill', () => {
    const knights = makeUnit('knight', 'red', 0, 0)
    const weak = makeUnit('skeleton', 'blue', 3, 0, { count: 1 })
    const strong = makeUnit('deathKnight', 'blue', 3, 4, { id: 'blue-strong' })
    expect(chooseMove(battle([knights, weak, strong]))).toMatchObject({ type: 'attack' })
  })

  it('shooters shoot instead of walking into melee', () => {
    const crossbowmen = makeUnit('crossbowman', 'red', 0, 0)
    const ghouls = makeUnit('ghoul', 'blue', 5, 0)
    expect(chooseMove(battle([crossbowmen, ghouls]))).toEqual({ type: 'attack', targetId: ghouls.id })
  })

  it('walks toward the enemy when nothing is in reach', () => {
    const state = battle([makeUnit('swordsman', 'red', 0, 5), makeUnit('ghoul', 'blue', 14, 5)])
    expect(chooseMove(state)).toMatchObject({ type: 'move' })
  })

  const matchups: [Faction, Faction][] = [
    ['order', 'undead'],
    ['undead', 'dungeon'],
    ['dungeon', 'order'],
  ]
  for (const [red, blue] of matchups) {
    it(`plays a full ${red} vs ${blue} battle to the end`, { timeout: 30_000 }, () => {
      const { state } = playOut(createBattle({ red, blue }, 123))
      expect(state.winner).not.toBeNull()
    })
  }
})
