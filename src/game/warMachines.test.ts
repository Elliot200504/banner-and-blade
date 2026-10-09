import { describe, expect, it } from 'vitest'
import {
  applyMove,
  armyProblem,
  buildQueue,
  castProblem,
  createBattle,
  createHero,
  CREATURES,
  FIRST_AID_MAXIMUM,
  FIRST_AID_MINIMUM,
  hexToOffset,
  mostAffordable,
  offsetToHex,
  reachableHexes,
  standardArmy,
  withStack,
  type CreatureType,
  type GameState,
  type Player,
  type Unit,
} from './index'

function makeUnit(type: CreatureType, owner: Player, column: number, row: number, changes: Partial<Unit> = {}): Unit {
  const stats = CREATURES[type]

  return {
    id: `${owner}-${type}`,
    label: `${owner} ${stats.plural}`,
    type,
    owner,
    position: offsetToHex(column, row),
    count: stats.armyCount,
    startCount: stats.armyCount,
    topHp: stats.hp,
    shots: stats.shots,
    retaliationsLeft: 1,
    defending: false,
    waited: false,
    hadMoraleTurn: false,
    petrified: false,
    lostTurn: false,
    specialty: false,
    effects: [],
    ...changes,
  }
}

/** A battle with only the given units, acting in the given order, led by heroes without morale or luck. */
function battle(units: Unit[]): GameState {
  const hero = { ...createHero('tyris'), morale: 0, luck: 0, mana: 50 }

  return {
    ...createBattle({ red: 'castle', blue: 'necropolis' }, 1),
    units,
    obstacles: [],
    queue: units.map((unit) => unit.id),
    heroes: { red: hero, blue: hero },
  }
}

const find = (state: GameState, id: string) => state.units.find((unit) => unit.id === id)!

describe('war machines', () => {
  it('a ballista never moves and never fights in melee', () => {
    const ballista = makeUnit('ballista', 'red', 0, 0)
    const skeletons = makeUnit('skeleton', 'blue', 1, 0)
    const state = battle([ballista, skeletons])
    expect(reachableHexes(state, ballista).size).toBe(0)
    expect(applyMove(state, { type: 'move', to: offsetToHex(1, 1) })).toBe(state)
  })

  it('a ballista shoots even with an enemy beside it, and never runs out of bolts', () => {
    const state = battle([makeUnit('ballista', 'red', 0, 0), makeUnit('skeleton', 'blue', 1, 0, { count: 50 })])
    const next = applyMove(state, { type: 'attack', targetId: 'blue-skeleton' })
    expect(next).not.toBe(state)
    expect(next.events[0]).toMatchObject({ kind: 'attack', ranged: true })
    expect(find(next, 'red-ballista').shots).toBe(CREATURES.ballista.shots)
  })

  it('war machines never strike back', () => {
    const state = battle([makeUnit('swordsman', 'red', 1, 0), makeUnit('ballista', 'blue', 0, 0)])
    const next = applyMove(state, { type: 'attack', targetId: 'blue-ballista' })
    expect(next.events.filter((event) => event.kind === 'attack')).toHaveLength(1)
  })

  it('an ammo cart keeps its side supplied', () => {
    const archers = makeUnit('archer', 'red', 0, 0)
    const target = makeUnit('walkingDead', 'blue', 5, 0)
    const withCart = applyMove(battle([archers, target, makeUnit('ammoCart', 'red', 0, 1)]), { type: 'attack', targetId: target.id })
    const without = applyMove(battle([archers, target]), { type: 'attack', targetId: target.id })
    expect(withCart.events[0]).toMatchObject({ kind: 'attack', ranged: true })
    expect(find(withCart, archers.id).shots).toBe(CREATURES.archer.shots)
    expect(find(without, archers.id).shots).toBe(CREATURES.archer.shots - 1)
  })

  it('the tent and the cart never take a turn', () => {
    const units = [makeUnit('ballista', 'red', 0, 0), makeUnit('firstAidTent', 'red', 0, 10), makeUnit('ammoCart', 'red', 0, 1)]
    expect(buildQueue(units, 1)).toEqual(['red-ballista'])
  })

  it("a first aid tent heals the top creature of its side's most wounded stack each round", () => {
    const pikemen = makeUnit('pikeman', 'red', 0, 2, { topHp: 9 })
    const angels = makeUnit('angel', 'red', 0, 4, { topHp: 100 })
    const tent = makeUnit('firstAidTent', 'red', 0, 10)
    const skeletons = makeUnit('skeleton', 'blue', 14, 5)
    const state = { ...battle([pikemen, angels, tent, skeletons]), queue: ['red-pikeman'] }
    // The last stack of the round defends, so the next round begins.
    const next = applyMove(state, { type: 'defend' })
    const healed = find(next, 'red-angel').topHp - 100
    expect(healed).toBeGreaterThanOrEqual(FIRST_AID_MINIMUM)
    expect(healed).toBeLessThanOrEqual(FIRST_AID_MAXIMUM)
    expect(find(next, 'red-pikeman').topHp).toBe(9)
    expect(next.events).toContainEqual(expect.objectContaining({ kind: 'heal', unitId: 'red-angel', amount: healed }))
  })

  it('spells cannot touch war machines', () => {
    const state = battle([makeUnit('pikeman', 'red', 0, 0), makeUnit('ballista', 'blue', 14, 0)])
    expect(castProblem(state, 'magicArrow', 'blue-ballista')).toMatch(/immune/)
  })

  it('war machines alone cannot hold the field', () => {
    const state = battle([makeUnit('cavalier', 'red', 1, 0), makeUnit('skeleton', 'blue', 2, 0, { count: 1 }), makeUnit('ballista', 'blue', 14, 0)])
    const next = applyMove(state, { type: 'attack', targetId: 'blue-skeleton' })
    expect(next.winner).toBe('red')
  })

  it('stand at the ends of the back line, with the creatures spread between them', () => {
    const creatures = standardArmy('castle').filter((stack) => stack.type !== 'angel')
    const army = withStack(withStack(creatures, 'castle', 'ballista', 1), 'castle', 'firstAidTent', 1)
    expect(armyProblem(army, 'castle')).toBeNull()
    const state = createBattle({ red: 'castle', blue: 'necropolis' }, 3, {}, { red: army })
    const reds = state.units.filter((unit) => unit.owner === 'red')
    expect(reds).toHaveLength(8)
    expect(hexToOffset(find(state, 'red-ballista').position)).toEqual({ column: 0, row: 0 })
    expect(hexToOffset(find(state, 'red-firstAidTent').position)).toEqual({ column: 0, row: 10 })
    expect(new Set(reds.map((unit) => hexToOffset(unit.position).row)).size).toBe(reds.length)
    expect(state.queue).not.toContain('red-firstAidTent')
  })

  it('an army can buy one of each machine, but needs creatures too', () => {
    const army = withStack(withStack(standardArmy('castle').slice(0, 3), 'castle', 'ballista', 1), 'castle', 'ammoCart', 1)
    expect(armyProblem(army, 'castle')).toBeNull()
    expect(army.slice(-2).map((stack) => stack.type)).toEqual(['ballista', 'ammoCart'])
    expect(mostAffordable(army, 'ballista')).toBe(1)
    expect(armyProblem([{ type: 'ballista', count: 2 }, { type: 'pikeman', count: 1 }], 'castle')).toMatch(/only one/)
    expect(armyProblem([{ type: 'ballista', count: 1 }], 'castle')).toMatch(/creatures/)
  })
})
