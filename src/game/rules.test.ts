import { describe, expect, it } from 'vitest'
import {
  activeUnit,
  afterDamage,
  applyMove,
  attackMode,
  castProblem,
  createBattle,
  createHero,
  CREATURES,
  damageRange,
  effectiveSpeed,
  heroesOf,
  castProblem as whyNotCast,
  spellDamage,
  hexKey,
  moraleOf,
  hexToOffset,
  offsetToHex,
  reachableHexes,
  COLUMNS,
  type CreatureType,
  type GameState,
  type Hero,
  type Player,
  type Unit,
} from './index'

/** A hero with no bonuses, morale or luck, so results are predictable. */
function plainHero(changes: Partial<Hero> = {}): Hero {
  return { ...createHero('tyris'), attack: 0, defense: 0, morale: 0, luck: 0, ...changes }
}

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
    retaliationsLeft: stats.abilities.includes('doubleRetaliation') ? 2 : 1,
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

/** A battle with only the given units, acting in the given order. */
function battle(units: Unit[], heroes: Partial<Record<Player, Hero>> = {}): GameState {
  return {
    ...createBattle({ red: 'castle', blue: 'necropolis' }, 1),
    units,
    obstacles: [],
    queue: units.map((unit) => unit.id),
    heroes: { red: plainHero(), blue: plainHero(), ...heroes },
    log: [],
  }
}

const find = (state: GameState, id: string) => state.units.find((unit) => unit.id === id)

describe('setup', () => {
  const state = createBattle({ red: 'castle', blue: 'necropolis' }, 42)

  it('gives each side seven stacks on its own edge', () => {
    expect(state.units.filter((unit) => unit.owner === 'red')).toHaveLength(7)
    expect(state.units.filter((unit) => unit.owner === 'blue')).toHaveLength(7)
    for (const unit of state.units) {
      expect(hexToOffset(unit.position).column).toBe(unit.owner === 'red' ? 0 : COLUMNS - 1)
    }
  })

  it('places obstacles away from the armies', () => {
    expect(state.obstacles.length).toBeGreaterThan(0)
    for (const obstacle of state.obstacles) {
      const { column } = hexToOffset(obstacle.position)
      expect(column).toBeGreaterThanOrEqual(3)
      expect(column).toBeLessThanOrEqual(COLUMNS - 4)
    }
  })

  it('orders the queue by speed, fastest first', () => {
    const speeds = state.queue.map((id) => effectiveSpeed(find(state, id)!))
    expect([...speeds].sort((higher, lower) => lower - higher)).toEqual(speeds)
  })

  it("dresses each half of the field in its army's homeland", () => {
    const field = createBattle({ red: 'necropolis', blue: 'dungeon' }, 5)
    for (const obstacle of field.obstacles) {
      const { column } = hexToOffset(obstacle.position)
      if (column < 7) expect(['deadTree', 'tombstone']).toContain(obstacle.kind)
      if (column > 7) expect(['stalagmite', 'crystal']).toContain(obstacle.kind)
    }
  })

  it('is the same for the same seed', () => {
    expect(createBattle({ red: 'castle', blue: 'necropolis' }, 42)).toEqual(state)
  })
})

describe('movement', () => {
  it('walkers go around units, flyers go over them', () => {
    const walker = makeUnit('swordsman', 'red', 0, 0)
    const flyer = makeUnit('griffin', 'red', 0, 2)
    const wall = [1, 3, 5].map((row, index) => makeUnit('skeleton', 'blue', 1, row, { id: `wall-${index}` }))
    const state = battle([walker, flyer, ...wall])
    const flyerReach = reachableHexes(state, flyer)
    expect(flyerReach.has(hexKey(offsetToHex(2, 2)))).toBe(true)
    expect(flyerReach.has(hexKey(offsetToHex(1, 3)))).toBe(false)
    expect(reachableHexes(state, walker).has(hexKey(offsetToHex(1, 1)))).toBe(false)
  })

  it('moves the unit and passes the turn', () => {
    const state = battle([makeUnit('swordsman', 'red', 0, 0), makeUnit('skeleton', 'blue', 14, 10)])
    const next = applyMove(state, { type: 'move', to: offsetToHex(3, 0) })
    expect(find(next, 'red-swordsman')!.position).toEqual(offsetToHex(3, 0))
    expect(activeUnit(next)?.id).toBe('blue-skeleton')
  })

  it('rejects moves beyond speed', () => {
    const state = battle([makeUnit('walkingDead', 'blue', 0, 0), makeUnit('pikeman', 'red', 14, 10)])
    expect(applyMove(state, { type: 'move', to: offsetToHex(4, 0) })).toBe(state)
  })
})

describe('stacks and damage', () => {
  it('removes whole creatures and tracks the top one', () => {
    const skeletons = makeUnit('skeleton', 'blue', 0, 0, { count: 10, topHp: 6 })
    expect(afterDamage(skeletons, 14)).toEqual({ count: 8, topHp: 4, kills: 2 })
    expect(afterDamage(skeletons, 999)).toEqual({ count: 0, topHp: 0, kills: 10 })
  })

  it('rolls damage inside the shown range', () => {
    const state = battle([makeUnit('swordsman', 'red', 0, 0), makeUnit('cavalier', 'blue', 1, 0)])
    const [swordsmen, cavaliers] = state.units
    const range = damageRange(swordsmen, plainHero(), cavaliers, plainHero(), { ranged: false, hexesMoved: 0 })
    const next = applyMove(state, { type: 'attack', targetId: cavaliers.id })
    const attack = next.events.find((event) => event.kind === 'attack')!
    expect(attack.kind === 'attack' && attack.damage).toBeGreaterThanOrEqual(range.minimum)
    expect(attack.kind === 'attack' && attack.damage).toBeLessThanOrEqual(range.maximum)
  })

  it('higher attack than defense means more damage', () => {
    const attacker = makeUnit('swordsman', 'red', 0, 0)
    const target = makeUnit('cavalier', 'blue', 1, 0)
    const plain = damageRange(attacker, plainHero(), target, plainHero(), { ranged: false, hexesMoved: 0 })
    const strong = damageRange(attacker, plainHero({ attack: 10 }), target, plainHero(), { ranged: false, hexesMoved: 0 })
    expect(strong.maximum).toBeGreaterThan(plain.maximum)
  })

  it('cavaliers charge harder the further they ride, except into pikemen', () => {
    const cavaliers = makeUnit('cavalier', 'red', 0, 0)
    const walkingDead = makeUnit('walkingDead', 'blue', 1, 0)
    const pikemen = makeUnit('pikeman', 'blue', 1, 0)
    const options = (hexesMoved: number) => ({ ranged: false, hexesMoved })
    expect(damageRange(cavaliers, plainHero(), walkingDead, plainHero(), options(5)).maximum).toBeGreaterThan(
      damageRange(cavaliers, plainHero(), walkingDead, plainHero(), options(0)).maximum,
    )
    expect(damageRange(cavaliers, plainHero(), pikemen, plainHero(), options(5))).toEqual(
      damageRange(cavaliers, plainHero(), pikemen, plainHero(), options(0)),
    )
  })
})

describe('shooting', () => {
  it('needs the target in range', () => {
    const archers = makeUnit('archer', 'red', 0, 0)
    const near = makeUnit('walkingDead', 'blue', 6, 0)
    const far = makeUnit('skeleton', 'blue', 14, 10)
    const state = battle([archers, near, far])
    expect(attackMode(state, archers, near)).toBe('shoot')
    expect(attackMode(state, archers, far)).toBe(null)
  })

  it('uses a shot and gets no retaliation', () => {
    const state = battle([makeUnit('archer', 'red', 0, 0), makeUnit('walkingDead', 'blue', 5, 0)])
    const next = applyMove(state, { type: 'attack', targetId: 'blue-walkingDead' })
    expect(find(next, 'red-archer')!.shots).toBe(CREATURES.archer.shots - 1)
    expect(next.events.filter((event) => event.kind === 'attack')).toHaveLength(1)
  })

  it('cannot shoot with an enemy adjacent, and fights at half damage', () => {
    const archers = makeUnit('archer', 'red', 0, 0)
    const walkingDead = makeUnit('walkingDead', 'blue', 1, 0)
    const state = battle([archers, walkingDead])
    expect(attackMode(state, archers, walkingDead)).toBe('melee')
    const melee = damageRange(archers, plainHero(), walkingDead, plainHero(), { ranged: false, hexesMoved: 0 })
    const shot = damageRange(archers, plainHero(), walkingDead, plainHero(), { ranged: true, hexesMoved: 0 })
    expect(melee.maximum).toBe(Math.floor(shot.maximum / 2))
  })

  it('falls back to melee when out of shots', () => {
    const archers = makeUnit('archer', 'red', 0, 0, { shots: 0 })
    const walkingDead = makeUnit('walkingDead', 'blue', 2, 0)
    expect(attackMode(battle([archers, walkingDead]), archers, walkingDead)).toBe('melee')
  })

  it("the lich's death cloud spares the undead", () => {
    const liches = makeUnit('lich', 'blue', 4, 4)
    const target = makeUnit('swordsman', 'red', 8, 4)
    const living = makeUnit('pikeman', 'red', 9, 4)
    const undead = makeUnit('skeleton', 'blue', 7, 4)
    const next = applyMove(battle([liches, target, living, undead]), { type: 'attack', targetId: target.id })
    const hits = next.events.flatMap((event) => (event.kind === 'attack' ? [event.targetId] : []))
    expect(hits).toContain(target.id)
    expect(hits).toContain(living.id)
    expect(hits).not.toContain(undead.id)
  })
})

describe('retaliation', () => {
  it('strikes back once per round', () => {
    const first = makeUnit('swordsman', 'red', 0, 0)
    const second = makeUnit('pikeman', 'red', 0, 2)
    const target = makeUnit('cavalier', 'blue', 0, 1)
    const afterFirst = applyMove(battle([first, second, target]), { type: 'attack', targetId: target.id })
    expect(afterFirst.events.filter((event) => event.kind === 'attack')).toHaveLength(2)
    const afterSecond = applyMove(afterFirst, { type: 'attack', targetId: target.id })
    expect(afterSecond.events.filter((event) => event.kind === 'attack')).toHaveLength(1)
  })

  it('griffins strike back twice', () => {
    const first = makeUnit('skeleton', 'blue', 0, 0)
    const second = makeUnit('walkingDead', 'blue', 0, 2)
    const griffins = makeUnit('griffin', 'red', 0, 1)
    const afterFirst = applyMove(battle([first, second, griffins]), { type: 'attack', targetId: griffins.id })
    const afterSecond = applyMove(afterFirst, { type: 'attack', targetId: griffins.id })
    expect(afterSecond.events.filter((event) => event.kind === 'attack')).toHaveLength(2)
  })

  it('nobody strikes back at vampires', () => {
    const state = battle([makeUnit('vampire', 'blue', 0, 0), makeUnit('swordsman', 'red', 1, 0)])
    const next = applyMove(state, { type: 'attack', targetId: 'red-swordsman' })
    expect(next.events.filter((event) => event.kind === 'attack')).toHaveLength(1)
  })
})

describe('turns', () => {
  it('wait moves the unit to the end of the round, once', () => {
    const state = battle([makeUnit('cavalier', 'red', 0, 0), makeUnit('walkingDead', 'blue', 14, 10)])
    const waited = applyMove(state, { type: 'wait' })
    expect(waited.queue).toEqual(['blue-walkingDead', 'red-cavalier'])
    const walkingDeadDone = applyMove(waited, { type: 'defend' })
    expect(activeUnit(walkingDeadDone)?.id).toBe('red-cavalier')
    expect(applyMove(walkingDeadDone, { type: 'wait' })).toBe(walkingDeadDone)
  })

  it('defending lasts until the next turn', () => {
    const state = battle([makeUnit('walkingDead', 'blue', 14, 10), makeUnit('cavalier', 'red', 0, 0)])
    const defended = applyMove(state, { type: 'defend' })
    expect(find(defended, 'blue-walkingDead')!.defending).toBe(true)
    // Round 2: the faster cavalier acts first, then the walkingDead's turn starts and its defend ends.
    const nextRound = applyMove(defended, { type: 'defend' })
    expect(find(nextRound, 'blue-walkingDead')!.defending).toBe(true)
    const walkingDeadTurn = applyMove(nextRound, { type: 'defend' })
    expect(activeUnit(walkingDeadTurn)?.id).toBe('blue-walkingDead')
    expect(find(walkingDeadTurn, 'blue-walkingDead')!.defending).toBe(false)
  })

  it('starts a new round when everyone has acted', () => {
    const state = battle([makeUnit('cavalier', 'red', 0, 0), makeUnit('walkingDead', 'blue', 14, 10)])
    const next = applyMove(applyMove(state, { type: 'defend' }), { type: 'defend' })
    expect(next.round).toBe(2)
    expect(next.queue).toHaveLength(2)
  })

  it('wraiths regenerate at the start of their turn', () => {
    const state = battle([makeUnit('cavalier', 'red', 0, 0), makeUnit('wight', 'blue', 14, 10, { topHp: 3 })])
    const next = applyMove(state, { type: 'defend' })
    expect(find(next, 'blue-wight')!.topHp).toBe(CREATURES.wight.hp)
  })

  it('good morale can grant an extra turn', () => {
    const always = plainHero({ morale: 24 })
    const state = battle([makeUnit('swordsman', 'red', 0, 0), makeUnit('walkingDead', 'blue', 14, 10)], { red: always })
    const next = applyMove(state, { type: 'move', to: offsetToHex(1, 0) })
    expect(activeUnit(next)?.id).toBe('red-swordsman')
    expect(applyMove(next, { type: 'move', to: offsetToHex(2, 0) }).queue[0]).toBe('blue-walkingDead')
  })
})

describe('spells', () => {
  it('magic arrow deals 10 + 10 × power and does not end the turn', () => {
    const hero = plainHero({ spellPower: 2 })
    const state = battle([makeUnit('swordsman', 'red', 0, 0), makeUnit('walkingDead', 'blue', 14, 10)], { red: hero })
    const next = applyMove(state, { type: 'cast', spell: 'magicArrow', targetId: 'blue-walkingDead' })
    const walkingDead = find(next, 'blue-walkingDead')!
    expect(CREATURES.walkingDead.hp * CREATURES.walkingDead.armyCount - ((walkingDead.count - 1) * 20 + walkingDead.topHp)).toBe(30)
    expect(activeUnit(next)?.id).toBe('red-swordsman')
    expect(next.heroes.red.mana).toBe(hero.mana - 5)
  })

  it('only one spell per round, and only on valid targets', () => {
    const state = battle([makeUnit('swordsman', 'red', 0, 0), makeUnit('walkingDead', 'blue', 14, 10)])
    expect(castProblem(state, 'haste', 'blue-walkingDead')).not.toBeNull()
    const hasted = applyMove(state, { type: 'cast', spell: 'haste', targetId: 'red-swordsman' })
    expect(effectiveSpeed(find(hasted, 'red-swordsman')!)).toBe(CREATURES.swordsman.speed + 3)
    expect(applyMove(hasted, { type: 'cast', spell: 'bless', targetId: 'red-swordsman' })).toBe(hasted)
  })

  it('effects wear off after their rounds', () => {
    const hero = plainHero({ spellPower: 1 })
    const state = battle([makeUnit('swordsman', 'red', 0, 0), makeUnit('walkingDead', 'blue', 14, 10)], { red: hero })
    const slowed = applyMove(state, { type: 'cast', spell: 'slow', targetId: 'blue-walkingDead' })
    expect(find(slowed, 'blue-walkingDead')!.effects).toHaveLength(1)
    const nextRound = applyMove(applyMove(slowed, { type: 'defend' }), { type: 'defend' })
    expect(find(nextRound, 'blue-walkingDead')!.effects).toHaveLength(0)
  })
})

describe('dungeon', () => {
  it('fields six dungeon stacks', () => {
    const state = createBattle({ red: 'dungeon', blue: 'castle' }, 7)
    const types = state.units.filter((unit) => unit.owner === 'red').map((unit) => unit.type)
    expect(types).toEqual(['troglodyte', 'harpy', 'beholder', 'medusa', 'minotaur', 'redDragon'])
    expect(state.heroes.red.name).toBe('Lorelei')
  })

  it('harpies fly back to where they started after a melee attack', () => {
    const harpies = makeUnit('harpy', 'red', 0, 0)
    const skeletons = makeUnit('skeleton', 'blue', 4, 0)
    const next = applyMove(battle([harpies, skeletons]), { type: 'attack', targetId: skeletons.id, from: offsetToHex(3, 0) })
    expect(find(next, harpies.id)?.position).toEqual(harpies.position)
    expect(next.events.filter((event) => event.kind === 'attack')).toHaveLength(2)
    expect(next.events[next.events.length - 1]).toMatchObject({ kind: 'move', unitId: harpies.id })
  })

  it('harpies already next to the target stay put', () => {
    const harpies = makeUnit('harpy', 'red', 0, 0)
    const skeletons = makeUnit('skeleton', 'blue', 1, 0)
    const next = applyMove(battle([harpies, skeletons]), { type: 'attack', targetId: skeletons.id })
    expect(next.events.some((event) => event.kind === 'move')).toBe(false)
  })

  it('medusas sometimes turn their target to stone', () => {
    const outcomes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((seed) => {
      const state = { ...battle([makeUnit('medusa', 'red', 0, 0), makeUnit('cavalier', 'blue', 5, 0)]), seed }
      return applyMove(state, { type: 'attack', targetId: 'blue-cavalier' }).events.some((event) => event.kind === 'petrify')
    })
    expect(outcomes).toContain(true)
    expect(outcomes).toContain(false)
  })

  it('a petrified stack loses its next turn and stays stone until the one after', () => {
    const state = battle([makeUnit('cavalier', 'red', 0, 0), makeUnit('walkingDead', 'blue', 14, 10, { petrified: true })])
    const skipped = applyMove(state, { type: 'defend' })
    expect(skipped.round).toBe(2)
    expect(activeUnit(skipped)?.id).toBe('red-cavalier')
    expect(skipped.events.some((event) => event.kind === 'stoneSkip')).toBe(true)
    expect(find(skipped, 'blue-walkingDead')?.petrified).toBe(true)

    const freed = applyMove(skipped, { type: 'defend' })
    expect(activeUnit(freed)?.id).toBe('blue-walkingDead')
    expect(find(freed, 'blue-walkingDead')?.petrified).toBe(false)
  })

  it('a medusa cannot petrify a stack that is already stone', () => {
    const outcomes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((seed) => {
      const cavaliers = makeUnit('cavalier', 'blue', 5, 0, { petrified: true, lostTurn: true })
      const state = { ...battle([makeUnit('medusa', 'red', 0, 0), cavaliers]), seed }
      return applyMove(state, { type: 'attack', targetId: 'blue-cavalier' }).events.some((event) => event.kind === 'petrify')
    })
    expect(outcomes).not.toContain(true)
  })

  it('a petrified stack cannot strike back', () => {
    const state = battle([makeUnit('swordsman', 'red', 0, 0), makeUnit('walkingDead', 'blue', 1, 0, { petrified: true })])
    const next = applyMove(state, { type: 'attack', targetId: 'blue-walkingDead' })
    expect(next.events.filter((event) => event.kind === 'attack')).toHaveLength(1)
  })

  it('cure breaks the stone', () => {
    const hero = plainHero({ mana: 50 })
    const state = battle([makeUnit('swordsman', 'red', 0, 0, { petrified: true }), makeUnit('walkingDead', 'blue', 14, 10)], { red: hero })
    const next = applyMove(state, { type: 'cast', spell: 'cure', targetId: 'red-swordsman' })
    expect(find(next, 'red-swordsman')?.petrified).toBe(false)
  })

  it("the dragon's breath also burns the stack behind the target, even a friendly one", () => {
    const dragons = makeUnit('redDragon', 'red', 2, 4)
    const target = makeUnit('walkingDead', 'blue', 3, 4)
    const behind = makeUnit('pikeman', 'red', 4, 4)
    const beside = makeUnit('skeleton', 'blue', 3, 3)
    const next = applyMove(battle([dragons, target, behind, beside]), { type: 'attack', targetId: target.id })
    const burned = next.events.flatMap((event) => (event.kind === 'attack' && event.splash ? [event.targetId] : []))
    expect(burned).toEqual([behind.id])
    expect(find(next, behind.id)!.count).toBeLessThan(behind.count)
    expect(find(next, beside.id)!.count).toBe(beside.count)
  })

  it('minotaurs have one more morale than their hero', () => {
    const hero = plainHero({ morale: 1 })
    expect(moraleOf(makeUnit('minotaur', 'red', 0, 0), hero)).toBe(2)
    expect(moraleOf(makeUnit('troglodyte', 'red', 0, 0), hero)).toBe(1)
  })
})

describe('heroes', () => {
  it('each faction has three heroes, and the chosen one leads', () => {
    expect(heroesOf('castle')).toEqual(['tyris', 'edric', 'adela'])
    expect(heroesOf('necropolis')).toEqual(['vokial', 'septienna', 'thant'])
    expect(heroesOf('dungeon')).toEqual(['lorelei', 'dace', 'deemer'])
    const state = createBattle({ red: 'castle', blue: 'dungeon' }, 1, { red: 'adela', blue: 'tyris' })
    expect(state.heroes.red.id).toBe('adela')
    // A hero from another faction is ignored.
    expect(state.heroes.blue.id).toBe('lorelei')
  })

  it("creature specialists lead their creatures better", () => {
    const state = createBattle({ red: 'dungeon', blue: 'castle' }, 1, { red: 'lorelei' })
    const harpies = find(state, 'red-harpy')!
    const troglodytes = find(state, 'red-troglodyte')!
    expect(harpies.specialty).toBe(true)
    expect(troglodytes.specialty).toBe(false)
    expect(effectiveSpeed(harpies)).toBe(CREATURES.harpy.speed + 1)
  })

  it('only the specialist knows their special spell', () => {
    const units = [makeUnit('swordsman', 'red', 0, 0), makeUnit('walkingDead', 'blue', 14, 10)]
    expect(whyNotCast(battle(units, { red: plainHero() }), 'deathRipple')).toMatch(/does not know/)
    expect(whyNotCast(battle(units, { red: { ...createHero('septienna'), mana: 50 } }), 'deathRipple')).toBeNull()
  })

  it('death ripple hits every living stack and spares the undead', () => {
    const hero = { ...createHero('septienna'), mana: 50 }
    const units = [makeUnit('lich', 'red', 0, 0), makeUnit('swordsman', 'red', 0, 2), makeUnit('cavalier', 'blue', 14, 10)]
    const next = applyMove(battle(units, { red: hero }), { type: 'cast', spell: 'deathRipple' })
    const hit = next.events.flatMap((event) => (event.kind === 'spell' ? [event.targetId] : []))
    expect(hit).toEqual(['red-swordsman', 'blue-cavalier'])
    expect(spellDamage('deathRipple', hero)).toBe(Math.floor((10 + 5 * hero.spellPower) * 1.5))
  })

  it('meteor shower hits the target and everything next to it', () => {
    const hero = { ...createHero('deemer'), mana: 50 }
    const target = makeUnit('cavalier', 'blue', 7, 4)
    const neighbour = makeUnit('swordsman', 'red', 8, 4)
    const far = makeUnit('walkingDead', 'blue', 12, 4)
    const state = battle([makeUnit('troglodyte', 'red', 0, 0), target, neighbour, far], { red: hero })
    const next = applyMove(state, { type: 'cast', spell: 'meteorShower', targetId: target.id })
    const hit = next.events.flatMap((event) => (event.kind === 'spell' ? [event.targetId] : []))
    expect(hit.sort()).toEqual([target.id, neighbour.id].sort())
  })

  it('animate dead raises fallen undead, but never past the starting stack', () => {
    const hero = { ...createHero('thant'), mana: 50 }
    const vampires = makeUnit('vampire', 'red', 0, 0, { count: 2, topHp: 10 })
    const state = battle([vampires, makeUnit('cavalier', 'blue', 14, 10)], { red: hero })
    const next = applyMove(state, { type: 'cast', spell: 'animateDead', targetId: vampires.id })
    const raised = find(next, vampires.id)!
    expect(raised.count).toBeGreaterThan(2)
    expect(raised.count).toBeLessThanOrEqual(CREATURES.vampire.armyCount)
    const living = battle([makeUnit('swordsman', 'red', 0, 0), makeUnit('cavalier', 'blue', 14, 10)], { red: hero })
    expect(whyNotCast(living, 'animateDead', 'red-swordsman')).toMatch(/only works on the undead/)
  })

  it("Adela's blessings hit harder", () => {
    const attacker = makeUnit('swordsman', 'red', 0, 0, { effects: [{ effect: 'bless', roundsLeft: 2 }] })
    const target = makeUnit('cavalier', 'blue', 1, 0)
    const adela = { ...createHero('adela'), attack: 0 }
    const other = { ...createHero('tyris'), attack: 0 }
    const options = { ranged: false, hexesMoved: 0 }
    const withAdela = damageRange(attacker, adela, target, plainHero(), options).maximum
    const withOther = damageRange(attacker, other, target, plainHero(), options).maximum
    expect(withAdela).toBeGreaterThan(withOther)
  })
})

describe('end of battle', () => {
  it('declares a winner and counts casualties', () => {
    const state = battle([
      makeUnit('cavalier', 'red', 0, 0),
      makeUnit('skeleton', 'blue', 1, 0, { count: 1, topHp: 1 }),
    ])
    const next = applyMove(state, { type: 'attack', targetId: 'blue-skeleton' })
    expect(next.winner).toBe('red')
    expect(next.casualties.blue.skeleton).toBe(1)
    expect(applyMove(next, { type: 'defend' })).toBe(next)
  })

  it('retreating hands the win to the other side', () => {
    const state = battle([makeUnit('cavalier', 'red', 0, 0), makeUnit('walkingDead', 'blue', 14, 10)])
    const next = applyMove(state, { type: 'retreat' })
    expect(next.winner).toBe('blue')
    expect(next.retreated).toBe('red')
  })
})
