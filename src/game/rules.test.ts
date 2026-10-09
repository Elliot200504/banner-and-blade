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
  return { ...createHero('order'), attack: 0, defense: 0, morale: 0, luck: 0, ...changes }
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
    topHp: stats.hp,
    shots: stats.shots,
    retaliationsLeft: stats.abilities.includes('doubleRetaliation') ? 2 : 1,
    defending: false,
    waited: false,
    hadMoraleTurn: false,
    petrified: false,
    lostTurn: false,
    effects: [],
    ...changes,
  }
}

/** A battle with only the given units, acting in the given order. */
function battle(units: Unit[], heroes: Partial<Record<Player, Hero>> = {}): GameState {
  return {
    ...createBattle({ red: 'order', blue: 'undead' }, 1),
    units,
    obstacles: [],
    queue: units.map((unit) => unit.id),
    heroes: { red: plainHero(), blue: plainHero(), ...heroes },
    log: [],
  }
}

const find = (state: GameState, id: string) => state.units.find((unit) => unit.id === id)

describe('setup', () => {
  const state = createBattle({ red: 'order', blue: 'undead' }, 42)

  it('gives each side six stacks on its own edge', () => {
    expect(state.units.filter((unit) => unit.owner === 'red')).toHaveLength(6)
    expect(state.units.filter((unit) => unit.owner === 'blue')).toHaveLength(6)
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

  it('is the same for the same seed', () => {
    expect(createBattle({ red: 'order', blue: 'undead' }, 42)).toEqual(state)
  })
})

describe('movement', () => {
  it('walkers go around units, flyers go over them', () => {
    const walker = makeUnit('swordsman', 'red', 0, 0)
    const flyer = makeUnit('gryphon', 'red', 0, 2)
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
    const state = battle([makeUnit('ghoul', 'blue', 0, 0), makeUnit('spearman', 'red', 14, 10)])
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
    const state = battle([makeUnit('swordsman', 'red', 0, 0), makeUnit('knight', 'blue', 1, 0)])
    const [swordsmen, knights] = state.units
    const range = damageRange(swordsmen, plainHero(), knights, plainHero(), { ranged: false, hexesMoved: 0 })
    const next = applyMove(state, { type: 'attack', targetId: knights.id })
    const attack = next.events.find((event) => event.kind === 'attack')!
    expect(attack.kind === 'attack' && attack.damage).toBeGreaterThanOrEqual(range.minimum)
    expect(attack.kind === 'attack' && attack.damage).toBeLessThanOrEqual(range.maximum)
  })

  it('higher attack than defense means more damage', () => {
    const attacker = makeUnit('swordsman', 'red', 0, 0)
    const target = makeUnit('knight', 'blue', 1, 0)
    const plain = damageRange(attacker, plainHero(), target, plainHero(), { ranged: false, hexesMoved: 0 })
    const strong = damageRange(attacker, plainHero({ attack: 10 }), target, plainHero(), { ranged: false, hexesMoved: 0 })
    expect(strong.maximum).toBeGreaterThan(plain.maximum)
  })

  it('knights charge harder the further they ride, except into spearmen', () => {
    const knights = makeUnit('knight', 'red', 0, 0)
    const ghouls = makeUnit('ghoul', 'blue', 1, 0)
    const spearmen = makeUnit('spearman', 'blue', 1, 0)
    const options = (hexesMoved: number) => ({ ranged: false, hexesMoved })
    expect(damageRange(knights, plainHero(), ghouls, plainHero(), options(5)).maximum).toBeGreaterThan(
      damageRange(knights, plainHero(), ghouls, plainHero(), options(0)).maximum,
    )
    expect(damageRange(knights, plainHero(), spearmen, plainHero(), options(5))).toEqual(
      damageRange(knights, plainHero(), spearmen, plainHero(), options(0)),
    )
  })
})

describe('shooting', () => {
  it('needs the target in range', () => {
    const crossbowmen = makeUnit('crossbowman', 'red', 0, 0)
    const near = makeUnit('ghoul', 'blue', 6, 0)
    const far = makeUnit('skeleton', 'blue', 14, 10)
    const state = battle([crossbowmen, near, far])
    expect(attackMode(state, crossbowmen, near)).toBe('shoot')
    expect(attackMode(state, crossbowmen, far)).toBe(null)
  })

  it('uses a shot and gets no retaliation', () => {
    const state = battle([makeUnit('crossbowman', 'red', 0, 0), makeUnit('ghoul', 'blue', 5, 0)])
    const next = applyMove(state, { type: 'attack', targetId: 'blue-ghoul' })
    expect(find(next, 'red-crossbowman')!.shots).toBe(CREATURES.crossbowman.shots - 1)
    expect(next.events.filter((event) => event.kind === 'attack')).toHaveLength(1)
  })

  it('cannot shoot with an enemy adjacent, and fights at half damage', () => {
    const crossbowmen = makeUnit('crossbowman', 'red', 0, 0)
    const ghouls = makeUnit('ghoul', 'blue', 1, 0)
    const state = battle([crossbowmen, ghouls])
    expect(attackMode(state, crossbowmen, ghouls)).toBe('melee')
    const melee = damageRange(crossbowmen, plainHero(), ghouls, plainHero(), { ranged: false, hexesMoved: 0 })
    const shot = damageRange(crossbowmen, plainHero(), ghouls, plainHero(), { ranged: true, hexesMoved: 0 })
    expect(melee.maximum).toBe(Math.floor(shot.maximum / 2))
  })

  it('falls back to melee when out of shots', () => {
    const crossbowmen = makeUnit('crossbowman', 'red', 0, 0, { shots: 0 })
    const ghouls = makeUnit('ghoul', 'blue', 2, 0)
    expect(attackMode(battle([crossbowmen, ghouls]), crossbowmen, ghouls)).toBe('melee')
  })

  it("the lich's death cloud spares the undead", () => {
    const liches = makeUnit('lich', 'blue', 4, 4)
    const target = makeUnit('swordsman', 'red', 8, 4)
    const living = makeUnit('spearman', 'red', 9, 4)
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
    const second = makeUnit('spearman', 'red', 0, 2)
    const target = makeUnit('knight', 'blue', 0, 1)
    const afterFirst = applyMove(battle([first, second, target]), { type: 'attack', targetId: target.id })
    expect(afterFirst.events.filter((event) => event.kind === 'attack')).toHaveLength(2)
    const afterSecond = applyMove(afterFirst, { type: 'attack', targetId: target.id })
    expect(afterSecond.events.filter((event) => event.kind === 'attack')).toHaveLength(1)
  })

  it('gryphons strike back twice', () => {
    const first = makeUnit('skeleton', 'blue', 0, 0)
    const second = makeUnit('ghoul', 'blue', 0, 2)
    const gryphons = makeUnit('gryphon', 'red', 0, 1)
    const afterFirst = applyMove(battle([first, second, gryphons]), { type: 'attack', targetId: gryphons.id })
    const afterSecond = applyMove(afterFirst, { type: 'attack', targetId: gryphons.id })
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
    const state = battle([makeUnit('knight', 'red', 0, 0), makeUnit('ghoul', 'blue', 14, 10)])
    const waited = applyMove(state, { type: 'wait' })
    expect(waited.queue).toEqual(['blue-ghoul', 'red-knight'])
    const ghoulDone = applyMove(waited, { type: 'defend' })
    expect(activeUnit(ghoulDone)?.id).toBe('red-knight')
    expect(applyMove(ghoulDone, { type: 'wait' })).toBe(ghoulDone)
  })

  it('defending lasts until the next turn', () => {
    const state = battle([makeUnit('ghoul', 'blue', 14, 10), makeUnit('knight', 'red', 0, 0)])
    const defended = applyMove(state, { type: 'defend' })
    expect(find(defended, 'blue-ghoul')!.defending).toBe(true)
    // Round 2: the faster knight acts first, then the ghoul's turn starts and its defend ends.
    const nextRound = applyMove(defended, { type: 'defend' })
    expect(find(nextRound, 'blue-ghoul')!.defending).toBe(true)
    const ghoulTurn = applyMove(nextRound, { type: 'defend' })
    expect(activeUnit(ghoulTurn)?.id).toBe('blue-ghoul')
    expect(find(ghoulTurn, 'blue-ghoul')!.defending).toBe(false)
  })

  it('starts a new round when everyone has acted', () => {
    const state = battle([makeUnit('knight', 'red', 0, 0), makeUnit('ghoul', 'blue', 14, 10)])
    const next = applyMove(applyMove(state, { type: 'defend' }), { type: 'defend' })
    expect(next.round).toBe(2)
    expect(next.queue).toHaveLength(2)
  })

  it('wraiths regenerate at the start of their turn', () => {
    const state = battle([makeUnit('knight', 'red', 0, 0), makeUnit('wraith', 'blue', 14, 10, { topHp: 3 })])
    const next = applyMove(state, { type: 'defend' })
    expect(find(next, 'blue-wraith')!.topHp).toBe(CREATURES.wraith.hp)
  })

  it('good morale can grant an extra turn', () => {
    const always = plainHero({ morale: 24 })
    const state = battle([makeUnit('swordsman', 'red', 0, 0), makeUnit('ghoul', 'blue', 14, 10)], { red: always })
    const next = applyMove(state, { type: 'move', to: offsetToHex(1, 0) })
    expect(activeUnit(next)?.id).toBe('red-swordsman')
    expect(applyMove(next, { type: 'move', to: offsetToHex(2, 0) }).queue[0]).toBe('blue-ghoul')
  })
})

describe('spells', () => {
  it('magic arrow deals 10 + 10 × power and does not end the turn', () => {
    const hero = plainHero({ spellPower: 2 })
    const state = battle([makeUnit('swordsman', 'red', 0, 0), makeUnit('ghoul', 'blue', 14, 10)], { red: hero })
    const next = applyMove(state, { type: 'cast', spell: 'magicArrow', targetId: 'blue-ghoul' })
    const ghouls = find(next, 'blue-ghoul')!
    expect(CREATURES.ghoul.hp * CREATURES.ghoul.armyCount - ((ghouls.count - 1) * 20 + ghouls.topHp)).toBe(30)
    expect(activeUnit(next)?.id).toBe('red-swordsman')
    expect(next.heroes.red.mana).toBe(hero.mana - 5)
  })

  it('only one spell per round, and only on valid targets', () => {
    const state = battle([makeUnit('swordsman', 'red', 0, 0), makeUnit('ghoul', 'blue', 14, 10)])
    expect(castProblem(state, 'haste', 'blue-ghoul')).not.toBeNull()
    const hasted = applyMove(state, { type: 'cast', spell: 'haste', targetId: 'red-swordsman' })
    expect(effectiveSpeed(find(hasted, 'red-swordsman')!)).toBe(CREATURES.swordsman.speed + 3)
    expect(applyMove(hasted, { type: 'cast', spell: 'bless', targetId: 'red-swordsman' })).toBe(hasted)
  })

  it('effects wear off after their rounds', () => {
    const hero = plainHero({ spellPower: 1 })
    const state = battle([makeUnit('swordsman', 'red', 0, 0), makeUnit('ghoul', 'blue', 14, 10)], { red: hero })
    const slowed = applyMove(state, { type: 'cast', spell: 'slow', targetId: 'blue-ghoul' })
    expect(find(slowed, 'blue-ghoul')!.effects).toHaveLength(1)
    const nextRound = applyMove(applyMove(slowed, { type: 'defend' }), { type: 'defend' })
    expect(find(nextRound, 'blue-ghoul')!.effects).toHaveLength(0)
  })
})

describe('dungeon', () => {
  it('fields six dungeon stacks', () => {
    const state = createBattle({ red: 'dungeon', blue: 'order' }, 7)
    const types = state.units.filter((unit) => unit.owner === 'red').map((unit) => unit.type)
    expect(types).toEqual(['troglodyte', 'harpy', 'beholder', 'medusa', 'minotaur', 'blackDragon'])
    expect(state.heroes.red.name).toBe('Vyrex the Shadowlord')
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
      const state = { ...battle([makeUnit('medusa', 'red', 0, 0), makeUnit('knight', 'blue', 5, 0)]), seed }
      return applyMove(state, { type: 'attack', targetId: 'blue-knight' }).events.some((event) => event.kind === 'petrify')
    })
    expect(outcomes).toContain(true)
    expect(outcomes).toContain(false)
  })

  it('a petrified stack loses its next turn and stays stone until the one after', () => {
    const state = battle([makeUnit('knight', 'red', 0, 0), makeUnit('ghoul', 'blue', 14, 10, { petrified: true })])
    const skipped = applyMove(state, { type: 'defend' })
    expect(skipped.round).toBe(2)
    expect(activeUnit(skipped)?.id).toBe('red-knight')
    expect(skipped.events.some((event) => event.kind === 'stoneSkip')).toBe(true)
    expect(find(skipped, 'blue-ghoul')?.petrified).toBe(true)

    const freed = applyMove(skipped, { type: 'defend' })
    expect(activeUnit(freed)?.id).toBe('blue-ghoul')
    expect(find(freed, 'blue-ghoul')?.petrified).toBe(false)
  })

  it('a medusa cannot petrify a stack that is already stone', () => {
    const outcomes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((seed) => {
      const knights = makeUnit('knight', 'blue', 5, 0, { petrified: true, lostTurn: true })
      const state = { ...battle([makeUnit('medusa', 'red', 0, 0), knights]), seed }
      return applyMove(state, { type: 'attack', targetId: 'blue-knight' }).events.some((event) => event.kind === 'petrify')
    })
    expect(outcomes).not.toContain(true)
  })

  it('a petrified stack cannot strike back', () => {
    const state = battle([makeUnit('swordsman', 'red', 0, 0), makeUnit('ghoul', 'blue', 1, 0, { petrified: true })])
    const next = applyMove(state, { type: 'attack', targetId: 'blue-ghoul' })
    expect(next.events.filter((event) => event.kind === 'attack')).toHaveLength(1)
  })

  it('cure breaks the stone', () => {
    const hero = plainHero({ mana: 50 })
    const state = battle([makeUnit('swordsman', 'red', 0, 0, { petrified: true }), makeUnit('ghoul', 'blue', 14, 10)], { red: hero })
    const next = applyMove(state, { type: 'cast', spell: 'cure', targetId: 'red-swordsman' })
    expect(find(next, 'red-swordsman')?.petrified).toBe(false)
  })

  it("the dragon's breath also burns the stack behind the target, even a friendly one", () => {
    const dragons = makeUnit('blackDragon', 'red', 2, 4)
    const target = makeUnit('ghoul', 'blue', 3, 4)
    const behind = makeUnit('spearman', 'red', 4, 4)
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

describe('end of battle', () => {
  it('declares a winner and counts casualties', () => {
    const state = battle([
      makeUnit('knight', 'red', 0, 0),
      makeUnit('skeleton', 'blue', 1, 0, { count: 1, topHp: 1 }),
    ])
    const next = applyMove(state, { type: 'attack', targetId: 'blue-skeleton' })
    expect(next.winner).toBe('red')
    expect(next.casualties.blue.skeleton).toBe(1)
    expect(applyMove(next, { type: 'defend' })).toBe(next)
  })

  it('retreating hands the win to the other side', () => {
    const state = battle([makeUnit('knight', 'red', 0, 0), makeUnit('ghoul', 'blue', 14, 10)])
    const next = applyMove(state, { type: 'retreat' })
    expect(next.winner).toBe('blue')
    expect(next.retreated).toBe('red')
  })
})
