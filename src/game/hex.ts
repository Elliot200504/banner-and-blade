// Axial hex coordinates (pointy-top). The board is a 9x7 rectangle stored in
// "odd-r" offset layout: odd rows are shifted half a hex to the right.

export interface Hex {
  q: number
  r: number
}

export const COLUMNS = 9
export const ROWS = 7

const DIRECTIONS: Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export const hexKey = (hex: Hex): string => `${hex.q},${hex.r}`

export const sameHex = (first: Hex, second: Hex): boolean => first.q === second.q && first.r === second.r

export function neighbors(hex: Hex): Hex[] {
  return DIRECTIONS.map((direction) => ({ q: hex.q + direction.q, r: hex.r + direction.r }))
}

export function hexDistance(from: Hex, to: Hex): number {
  const deltaQ = from.q - to.q
  const deltaR = from.r - to.r
  return (Math.abs(deltaQ) + Math.abs(deltaR) + Math.abs(deltaQ + deltaR)) / 2
}

export function offsetToHex(column: number, row: number): Hex {
  return { q: column - (row - (row & 1)) / 2, r: row }
}

export function hexToOffset(hex: Hex): { column: number; row: number } {
  return { column: hex.q + (hex.r - (hex.r & 1)) / 2, row: hex.r }
}

export function inBounds(hex: Hex): boolean {
  const { column, row } = hexToOffset(hex)
  return row >= 0 && row < ROWS && column >= 0 && column < COLUMNS
}

export function allHexes(): Hex[] {
  const hexes: Hex[] = []
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) hexes.push(offsetToHex(column, row))
  }
  return hexes
}
