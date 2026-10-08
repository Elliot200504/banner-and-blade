import { offsetToHex } from './hex'
import { buildQueue } from './rules'
import { UNIT_STATS, type UnitType } from './units'
import type { GameState, Player, Unit } from './types'
import { PLAYER_NAMES } from './types'

const NUMERALS = ['I', 'II', 'III', 'IV']

function makeUnit(owner: Player, type: UnitType, unitNumber: number, column: number, row: number): Unit {
  return {
    id: `${owner}-${type}-${unitNumber}`,
    label: `${PLAYER_NAMES[owner]} ${UNIT_STATS[type].name} ${NUMERALS[unitNumber - 1]}`,
    type,
    owner,
    position: offsetToHex(column, row),
    hp: UNIT_STATS[type].maxHp,
    retaliated: false,
    defending: false,
  }
}

export function createInitialState(): GameState {
  const units = [
    makeUnit('red', 'swordsman', 1, 1, 2),
    makeUnit('red', 'swordsman', 2, 1, 4),
    makeUnit('red', 'archer', 1, 0, 1),
    makeUnit('red', 'archer', 2, 0, 5),
    makeUnit('blue', 'swordsman', 1, 7, 2),
    makeUnit('blue', 'swordsman', 2, 7, 4),
    makeUnit('blue', 'archer', 1, 8, 1),
    makeUnit('blue', 'archer', 2, 8, 5),
  ]
  return {
    units,
    obstacles: [offsetToHex(4, 2), offsetToHex(4, 4)],
    round: 1,
    queue: buildQueue(units, 1),
    winner: null,
    log: ['— Round 1 —'],
    events: [],
  }
}
