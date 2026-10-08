import { describe, expect, it } from 'vitest'
import {
  activeUnit,
  applyMove,
  buildQueue,
  createInitialState,
  hexDistance,
  hexKey,
  offsetToHex,
  reachableHexes,
  type GameState,
  type Unit,
} from './index'

/** A state with only the given units, the first one active. */
function battle(units: Unit[]): GameState {
  return { ...createInitialState(), units, obstacles: [], queue: units.map((unit) => unit.id), log: [] }
}

function makeUnit(
  id: string,
  type: Unit['type'],
  owner: Unit['owner'],
  column: number,
  row: number,
  hp?: number,
): Unit {
  return {
    id,
    label: id,
    type,
    owner,
    position: offsetToHex(column, row),
    hp: hp ?? (type === 'swordsman' ? 30 : 18),
    retaliated: false,
    defending: false,
  }
}

function hpOf(state: GameState, id: string): number {
  return state.units.find((unit) => unit.id === id)!.hp
}

describe('hex math', () => {
  it('measures distance in hex steps', () => {
    expect(hexDistance(offsetToHex(0, 0), offsetToHex(3, 0))).toBe(3)
    expect(hexDistance(offsetToHex(0, 0), offsetToHex(0, 1))).toBe(1)
  })
})

describe('setup', () => {
  it('gives each side two swordsmen and two archers', () => {
    const state = createInitialState()
    for (const owner of ['red', 'blue'] as const) {
      const army = state.units.filter((unit) => unit.owner === owner)
      expect(army.filter((unit) => unit.type === 'swordsman')).toHaveLength(2)
      expect(army.filter((unit) => unit.type === 'archer')).toHaveLength(2)
    }
  })

  it('orders by initiative and alternates sides', () => {
    const state = createInitialState()
    expect(state.queue).toEqual([
      'red-swordsman-1',
      'blue-swordsman-1',
      'red-swordsman-2',
      'blue-swordsman-2',
      'red-archer-1',
      'blue-archer-1',
      'red-archer-2',
      'blue-archer-2',
    ])
    expect(buildQueue(state.units, 2)[0]).toBe('blue-swordsman-1')
  })
})

describe('movement', () => {
  it('respects move range and does not pass through units', () => {
    const state = battle([
      makeUnit('swordsman', 'swordsman', 'red', 0, 0),
      makeUnit('blocker', 'archer', 'red', 1, 0),
      makeUnit('enemy', 'archer', 'blue', 8, 6),
    ])
    const reach = reachableHexes(state, state.units[0])
    expect(reach.has(hexKey(offsetToHex(1, 0)))).toBe(false)
    for (const path of reach.values()) expect(path.length - 1).toBeLessThanOrEqual(3)
    // Going around the blocker takes 3 steps, so (2,0) is still reachable.
    expect(reach.get(hexKey(offsetToHex(2, 0)))).toHaveLength(4)
  })

  it('moves the unit and passes the turn', () => {
    const state = battle([makeUnit('swordsman', 'swordsman', 'red', 0, 0), makeUnit('enemy', 'archer', 'blue', 8, 6)])
    const next = applyMove(state, { type: 'move', to: offsetToHex(3, 0) })
    expect(next.units[0].position).toEqual(offsetToHex(3, 0))
    expect(activeUnit(next)?.id).toBe('enemy')
  })

  it('rejects moves out of range', () => {
    const state = battle([makeUnit('archer', 'archer', 'red', 0, 0), makeUnit('enemy', 'archer', 'blue', 8, 6)])
    expect(applyMove(state, { type: 'move', to: offsetToHex(3, 0) })).toBe(state)
  })
})

describe('combat', () => {
  it('melee attack triggers one retaliation per round', () => {
    const state = battle([
      makeUnit('first', 'swordsman', 'red', 0, 0),
      makeUnit('second', 'swordsman', 'red', 0, 2),
      makeUnit('target', 'swordsman', 'blue', 2, 0),
    ])
    const afterFirst = applyMove(state, { type: 'attack', targetId: 'target', from: offsetToHex(1, 0) })
    expect(hpOf(afterFirst, 'target')).toBe(21)
    expect(hpOf(afterFirst, 'first')).toBe(21)
    const afterSecond = applyMove(afterFirst, { type: 'attack', targetId: 'target', from: offsetToHex(1, 1) })
    expect(hpOf(afterSecond, 'target')).toBe(12)
    expect(hpOf(afterSecond, 'second')).toBe(30)
  })

  it('archers shoot anywhere without retaliation, at half damage when blocked', () => {
    const state = battle([makeUnit('archer', 'archer', 'red', 0, 0), makeUnit('target', 'swordsman', 'blue', 8, 6)])
    const shot = applyMove(state, { type: 'attack', targetId: 'target' })
    expect(hpOf(shot, 'target')).toBe(24)
    expect(hpOf(shot, 'archer')).toBe(18)

    const blocked = battle([makeUnit('archer', 'archer', 'red', 0, 0), makeUnit('target', 'swordsman', 'blue', 1, 0)])
    const halfShot = applyMove(blocked, { type: 'attack', targetId: 'target' })
    expect(hpOf(halfShot, 'target')).toBe(27)
  })

  it('defending reduces damage taken', () => {
    const state = battle([makeUnit('target', 'swordsman', 'blue', 8, 6), makeUnit('archer', 'archer', 'red', 0, 0)])
    const defended = applyMove(state, { type: 'defend' })
    const shot = applyMove(defended, { type: 'attack', targetId: 'target' })
    expect(hpOf(shot, 'target')).toBe(26)
  })

  it('removes dead units and declares a winner', () => {
    const state = battle([makeUnit('archer', 'archer', 'red', 0, 0), makeUnit('target', 'archer', 'blue', 8, 6, 5)])
    const next = applyMove(state, { type: 'attack', targetId: 'target' })
    expect(next.units).toHaveLength(1)
    expect(next.winner).toBe('red')
    expect(applyMove(next, { type: 'defend' })).toBe(next)
  })

  it('starts a new round when everyone has acted', () => {
    const state = battle([makeUnit('archer', 'archer', 'red', 0, 0), makeUnit('enemy', 'archer', 'blue', 8, 6)])
    const next = applyMove(applyMove(state, { type: 'defend' }), { type: 'defend' })
    expect(next.round).toBe(2)
    expect(next.queue).toHaveLength(2)
  })
})
