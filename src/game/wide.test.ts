import { describe, expect, it } from 'vitest'
import {
  applyMove,
  attackMode,
  createBattle,
  CREATURES,
  hexesOf,
  hexKey,
  hexToOffset,
  isEnemyAdjacent,
  offsetToHex,
  reachableHexes,
  unitAt,
  COLUMNS,
  type CreatureType,
  type GameState,
  type Player,
  type Unit,
} from './index'

function makeUnit(type: CreatureType, owner: Player, column: number, row: number): Unit {
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
  }
}

function board(units: Unit[], obstacles: GameState['obstacles'] = []): Pick<GameState, 'units' | 'obstacles'> {
  return { units, obstacles }
}

const columnsOf = (unit: Unit) => hexesOf(unit).map((hex) => hexToOffset(hex).column)

describe('wide creatures', () => {
  it('take the hex behind them, away from the enemy', () => {
    expect(columnsOf(makeUnit('cavalier', 'red', 5, 4))).toEqual([5, 4])
    expect(columnsOf(makeUnit('cavalier', 'blue', 5, 4))).toEqual([5, 6])
    expect(columnsOf(makeUnit('pikeman', 'red', 5, 4))).toEqual([5])
  })

  it('are found on either of their hexes', () => {
    const cavaliers = makeUnit('cavalier', 'red', 5, 4)

    expect(unitAt([cavaliers], offsetToHex(4, 4))).toBe(cavaliers)
    expect(unitAt([cavaliers], offsetToHex(3, 4))).toBeUndefined()
  })

  it('start one hex in from their edge, hindquarters on it', () => {
    const state = createBattle({ red: 'castle', blue: 'inferno' }, 7, {}, {
      red: [{ type: 'cavalier', count: 2 }],
      blue: [{ type: 'hellHound', count: 5 }],
    })

    for (const unit of state.units) {
      expect(columnsOf(unit)).toEqual(unit.owner === 'red' ? [1, 0] : [COLUMNS - 2, COLUMNS - 1])
    }
  })

  it('only move where their hindquarters fit too', () => {
    const cavaliers = makeUnit('cavalier', 'red', 5, 4)
    const reach = reachableHexes(board([cavaliers], [{ position: offsetToHex(7, 4), kind: 'rock' }]), cavaliers)

    // One step forward would put the hindquarters where the cavaliers' front is now: that is fine.
    expect(reach.has(hexKey(offsetToHex(6, 4)))).toBe(true)
    // Two steps forward would put the hindquarters on the rock.
    expect(reach.has(hexKey(offsetToHex(8, 4)))).toBe(false)
  })

  it('are next to anything touching either hex, and can be struck from there', () => {
    const cavaliers = makeUnit('cavalier', 'red', 5, 4)
    const imps = makeUnit('imp', 'blue', 3, 4)

    expect(isEnemyAdjacent([cavaliers, imps], cavaliers)).toBe(true)
    expect(attackMode(board([cavaliers, imps]), imps, cavaliers)).toBe('melee')
  })
})

describe('corpses', () => {
  it('are left where a stack dies, and nowhere while it lives', () => {
    const champions = { ...makeUnit('champion', 'red', 5, 4), count: 40 }
    const pikemen = { ...makeUnit('pikeman', 'blue', 6, 4), count: 1, topHp: 1 }
    const state: GameState = {
      ...createBattle({ red: 'castle', blue: 'castle' }, 3),
      units: [champions, pikemen],
      obstacles: [],
      queue: [champions.id, pikemen.id],
    }

    expect(state.corpses).toEqual([])

    const after = applyMove(state, { type: 'attack', targetId: pikemen.id })

    expect(after.corpses).toEqual([{ type: 'pikeman', owner: 'blue', position: pikemen.position }])
  })
})
