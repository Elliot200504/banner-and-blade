import { describe, expect, it } from 'vitest'
import {
  applyMove,
  ARMY_BUDGET,
  armyCost,
  armyProblem,
  baseOf,
  createBattle,
  createHero,
  createRandom,
  CREATURES,
  damageMultiplier,
  FACTION_ORDER,
  offsetToHex,
  randomArmy,
  standardArmy,
  UPGRADES,
  withStack,
  withUpgrade,
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

/** A battle with only the given units, acting in the given order, led by heroes without bonuses, morale or luck. */
function battle(units: Unit[]): GameState {
  const hero = { ...createHero('tyris'), attack: 0, defense: 0, morale: 0, luck: 0 }

  return {
    ...createBattle({ red: 'castle', blue: 'necropolis' }, 1),
    units,
    obstacles: [],
    queue: units.map((unit) => unit.id),
    heroes: { red: hero, blue: hero },
  }
}

const strikes = (state: GameState, attackerId: string) =>
  state.events.filter((event) => event.kind === 'attack' && event.attackerId === attackerId && !event.splash)

describe('upgraded creatures', () => {
  it('every creature has an upgrade of the same faction that is stronger and costs more', () => {
    for (const [base, upgrade] of Object.entries(UPGRADES)) {
      const plain = CREATURES[base as CreatureType]
      const better = CREATURES[upgrade]
      expect(better.faction).toBe(plain.faction)
      expect(better.cost).toBeGreaterThan(plain.cost)
      expect(better.attack + better.defense + better.hp + better.speed).toBeGreaterThan(plain.attack + plain.defense + plain.hp + plain.speed)
      expect(baseOf(upgrade)).toBe(base)
    }
  })

  it('marksmen shoot twice', () => {
    const state = battle([makeUnit('marksman', 'red', 0, 0), makeUnit('walkingDead', 'blue', 5, 0, { count: 30 })])
    const next = applyMove(state, { type: 'attack', targetId: 'blue-walkingDead' })
    expect(strikes(next, 'red-marksman')).toHaveLength(2)
    expect(next.units.find((unit) => unit.id === 'red-marksman')!.shots).toBe(CREATURES.marksman.shots - 1)
  })

  it('crusaders strike again after the target strikes back', () => {
    const state = battle([makeUnit('crusader', 'red', 1, 0), makeUnit('walkingDead', 'blue', 2, 0, { count: 30 })])
    const next = applyMove(state, { type: 'attack', targetId: 'blue-walkingDead' })
    const order = next.events.flatMap((event) => (event.kind === 'attack' ? [event.retaliation ? 'back' : 'strike'] : []))
    expect(order).toEqual(['strike', 'back', 'strike'])
  })

  it('royal griffins strike back at every attacker', () => {
    const griffins = makeUnit('royalGriffin', 'blue', 2, 0)
    const first = makeUnit('pikeman', 'red', 1, 0)
    const second = makeUnit('swordsman', 'red', 3, 0)
    let state = battle([first, second, griffins])
    state = applyMove(state, { type: 'attack', targetId: griffins.id })
    state = applyMove(state, { type: 'attack', targetId: griffins.id })
    expect(state.events.some((event) => event.kind === 'attack' && event.retaliation)).toBe(true)
  })

  it('vampire lords drain life from the living and raise their fallen', () => {
    const lords = makeUnit('vampireLord', 'red', 1, 0, { count: 3, startCount: 5 })
    const pikemen = makeUnit('pikeman', 'blue', 2, 0, { count: 40 })
    const next = applyMove(battle([lords, pikemen]), { type: 'attack', targetId: pikemen.id })
    const after = next.units.find((unit) => unit.id === lords.id)!
    const hp = CREATURES.vampireLord.hp
    expect((after.count - 1) * hp + after.topHp).toBeGreaterThan(3 * hp)
    expect(after.count).toBeGreaterThan(3)
    expect(after.count).toBeLessThanOrEqual(5)
    expect(next.events).toContainEqual(expect.objectContaining({ kind: 'heal', unitId: lords.id }))
  })

  it('vampire lords cannot drain the undead', () => {
    const lords = makeUnit('vampireLord', 'red', 1, 0, { count: 3, startCount: 5 })
    const skeletons = makeUnit('skeleton', 'blue', 2, 0, { count: 40 })
    const next = applyMove(battle([lords, skeletons]), { type: 'attack', targetId: skeletons.id })
    expect(next.events.some((event) => event.kind === 'heal')).toBe(false)
  })

  it('archangels and arch devils hate each other, and the creatures they were', () => {
    const archangels = makeUnit('archangel', 'red', 0, 0)
    const hero = createHero('tyris')
    const options = { ranged: false, hexesMoved: 0 }
    const versusDevil = damageMultiplier(archangels, hero, makeUnit('devil', 'blue', 1, 0), hero, options)
    const versusArchDevil = damageMultiplier(archangels, hero, makeUnit('archDevil', 'blue', 1, 0, { id: 'other' }), hero, options)
    const versusBehemoth = damageMultiplier(archangels, hero, makeUnit('behemoth', 'blue', 1, 0, { id: 'third' }), hero, options)
    expect(versusDevil).toBeGreaterThan(versusBehemoth)
    expect(versusArchDevil).toBeGreaterThan(1)
  })

  it("a creature specialist leads the creature's upgrade too", () => {
    const army = withUpgrade(standardArmy('castle'), 'castle', 'cavalier', true)
    const state = createBattle({ red: 'castle', blue: 'necropolis' }, 4, { red: 'tyris' }, { red: army })
    expect(state.units.find((unit) => unit.id === 'red-champion')?.specialty).toBe(true)
  })
})

describe('building an army with upgrades', () => {
  it('upgrading a stack keeps as many creatures as the gold allows', () => {
    const army = withUpgrade(standardArmy('castle'), 'castle', 'pikeman', true)
    expect(army[0]).toEqual({ type: 'halberdier', count: 14 })
    const angels = withUpgrade(army, 'castle', 'angel', true)
    expect(angels.find((stack) => stack.type === 'archangel')).toBeUndefined()
    expect(armyCost(angels)).toBeLessThanOrEqual(ARMY_BUDGET)
    expect(withUpgrade(army, 'castle', 'pikeman', false)[0]).toEqual({ type: 'pikeman', count: 14 })
  })

  it('a creature forms one stack, plain or upgraded', () => {
    const swapped = withStack(standardArmy('castle'), 'castle', 'crusader', 2)
    expect(swapped.filter((stack) => baseOf(stack.type) === 'swordsman')).toEqual([{ type: 'crusader', count: 2 }])
    expect(armyProblem([{ type: 'pikeman', count: 1 }, { type: 'halberdier', count: 1 }], 'castle')).toMatch(/only one stack/)
  })

  it('random armies sometimes upgrade, and stay legal', () => {
    let upgrades = 0

    for (const faction of FACTION_ORDER) {
      for (let seed = 1; seed <= 20; seed++) {
        const army = randomArmy(faction, createRandom(seed))
        expect(armyProblem(army, faction)).toBeNull()
        upgrades += army.filter((stack) => stack.type !== baseOf(stack.type)).length
      }
    }

    expect(upgrades).toBeGreaterThan(0)
  })
})
