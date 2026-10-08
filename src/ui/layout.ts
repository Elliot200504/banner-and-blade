import { COLUMNS, ROWS, type Hex } from '../game'

export interface Point {
  x: number
  y: number
}

export const HEX_SIZE = 26
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE
const MARGIN = 12
const OFFSET_X = MARGIN + HEX_WIDTH / 2
const OFFSET_Y = MARGIN + HEX_SIZE

export const BOARD_WIDTH = HEX_WIDTH * (COLUMNS + 0.5) + MARGIN * 2
export const BOARD_HEIGHT = HEX_SIZE * 1.5 * (ROWS - 1) + HEX_SIZE * 2 + MARGIN * 2

export function hexToPixel(hex: Hex): Point {
  return {
    x: OFFSET_X + HEX_WIDTH * (hex.q + hex.r / 2),
    y: OFFSET_Y + HEX_SIZE * 1.5 * hex.r,
  }
}

/** The hex under a point on the board (may be outside the board). */
export function pixelToHex(point: Point): Hex {
  const relativeX = point.x - OFFSET_X
  const relativeY = point.y - OFFSET_Y
  const fractionalQ = ((Math.sqrt(3) / 3) * relativeX - relativeY / 3) / HEX_SIZE
  const fractionalR = ((2 / 3) * relativeY) / HEX_SIZE
  return roundHex(fractionalQ, fractionalR)
}

function roundHex(fractionalQ: number, fractionalR: number): Hex {
  const fractionalS = -fractionalQ - fractionalR
  let roundedQ = Math.round(fractionalQ)
  let roundedR = Math.round(fractionalR)
  const roundedS = Math.round(fractionalS)
  const differenceQ = Math.abs(roundedQ - fractionalQ)
  const differenceR = Math.abs(roundedR - fractionalR)
  const differenceS = Math.abs(roundedS - fractionalS)
  if (differenceQ > differenceR && differenceQ > differenceS) roundedQ = -roundedR - roundedS
  else if (differenceR > differenceS) roundedR = -roundedQ - roundedS
  return { q: roundedQ, r: roundedR }
}

/** SVG points string for a pointy-top hexagon. */
export function hexCorners(center: Point, size = HEX_SIZE): string {
  const corners: string[] = []
  for (let corner = 0; corner < 6; corner++) {
    const angle = (Math.PI / 180) * (60 * corner - 30)
    corners.push(`${center.x + size * Math.cos(angle)},${center.y + size * Math.sin(angle)}`)
  }
  return corners.join(' ')
}

export function distanceBetween(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y)
}
