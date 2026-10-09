import { describe, expect, it } from 'vitest'
import {
  applyMove,
  ARMY_BUDGET,
  armyCost,
  armyProblem,
  createBattle,
  createHero,
  createRandom,
  CREATURES,
  FACTION_ORDER,
  hexToOffset,
  mostAffordable,
  randomArmy,
  standardArmy,
  withStack,
  type Faction,
} from './index'

const FACTION_LIST: Faction[] = FACTION_ORDER

describe('army building', () => {
  for (const faction of FACTION_LIST) {
    it(`the standard ${faction} army fits the budget`, () => {
      expect(armyProblem(standardArmy(faction), faction)).toBeNull()
      expect(armyCost(standardArmy(faction))).toBeLessThanOrEqual(ARMY_BUDGET)
    })

    it(`random ${faction} armies are always legal and spend most of the gold`, () => {
      for (let seed = 1; seed <= 50; seed++) {
        const army = randomArmy(faction, createRandom(seed))
        expect(armyProblem(army, faction)).toBeNull()
        expect(army.length).toBeGreaterThanOrEqual(1)
        expect(armyCost(army)).toBeGreaterThan(ARMY_BUDGET * 0.9)
      }
    })
  }


  it('rejects armies that are empty, too expensive or from another faction', () => {
    expect(armyProblem([], 'castle')).toMatch(/at least one/)
    expect(armyProblem([{ type: 'cavalier', count: 20 }], 'castle')).toMatch(/costs more/)
    expect(armyProblem([{ type: 'skeleton', count: 5 }], 'castle')).toMatch(/Only Castle/)
  })

  it('adds, changes and removes stacks in the faction order', () => {
    let army = withStack([], 'castle', 'cavalier', 2)
    army = withStack(army, 'castle', 'pikeman', 10)
    expect(army.map((stack) => stack.type)).toEqual(['pikeman', 'cavalier'])
    expect(withStack(army, 'castle', 'cavalier', 0)).toEqual([{ type: 'pikeman', count: 10 }])
    expect(mostAffordable([], 'cavalier')).toBe(Math.floor(ARMY_BUDGET / CREATURES.cavalier.cost))
  })

  it('takes the recruited armies into battle, spread down each edge', () => {
    const state = createBattle({ red: 'castle', blue: 'dungeon' }, 3, {}, {
      red: [{ type: 'cavalier', count: 8 }],
      blue: [{ type: 'harpy', count: 30 }, { type: 'redDragon', count: 2 }],
    })
    const red = state.units.filter((unit) => unit.owner === 'red')
    const blue = state.units.filter((unit) => unit.owner === 'blue')
    expect(red.map((unit) => [unit.type, unit.count, unit.startCount])).toEqual([['cavalier', 8, 8]])
    expect(hexToOffset(red[0].position).row).toBe(5)
    expect(blue.map((unit) => hexToOffset(unit.position).row)).toEqual([2, 8])
  })

  it('falls back to the standard army when a recruited one breaks the rules', () => {
    const state = createBattle({ red: 'castle', blue: 'necropolis' }, 3, {}, { red: [{ type: 'cavalier', count: 50 }] })
    expect(state.units.filter((unit) => unit.owner === 'red')).toHaveLength(7)
  })

  it('animate dead raises a stack only up to the size it was recruited at', () => {
    const state = createBattle({ red: 'necropolis', blue: 'castle' }, 3, { red: 'thant' }, {
      red: [{ type: 'vampire', count: 3 }],
    })
    const vampires = state.units.find((unit) => unit.owner === 'red')!
    const wounded = {
      ...state,
      queue: [vampires.id, ...state.queue.filter((id) => id !== vampires.id)],
      heroes: { ...state.heroes, red: { ...createHero('thant'), mana: 50 } },
      units: state.units.map((unit) => (unit.id === vampires.id ? { ...unit, count: 1, topHp: 5 } : unit)),
    }
    const next = applyMove(wounded, { type: 'cast', spell: 'animateDead', targetId: vampires.id })
    expect(next.units.find((unit) => unit.id === vampires.id)!.count).toBe(3)
  })
})
