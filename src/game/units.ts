export type UnitType = 'swordsman' | 'archer'

export interface UnitStats {
  name: string
  maxHp: number
  damage: number
  move: number
  initiative: number
  ranged: boolean
}

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  swordsman: { name: 'Swordsman', maxHp: 30, damage: 9, move: 3, initiative: 5, ranged: false },
  archer: { name: 'Archer', maxHp: 18, damage: 6, move: 2, initiative: 4, ranged: true },
}
