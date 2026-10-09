import { memo, type ReactNode } from 'react'
import { allHexes, COLUMNS, hexKey, hexToOffset, type Faction, type Obstacle, type Player } from '../game'
import { BOARD_HEIGHT, BOARD_WIDTH, hexToPixel } from './layout'

/** Ground colors: each army fights on its own homeland's half of the field. */
const GROUND: Record<Faction, string> = {
  order: '#4c7a33',
  undead: '#323238',
  dungeon: '#5a412c',
}

/** Size of one "pixel" in the decorations, to match the sprites' chunky look. */
const PIXEL = 2

const MIDDLE_COLUMN = Math.floor(COLUMNS / 2)

/** A small, fixed pseudo-random number per hex and slot, so the field looks the same on every render. */
function noise(q: number, r: number, slot: number): number {
  let value = Math.imul(q * 374761393 + r * 668265263 + slot * 2147483647, 1274126177)
  value = Math.imul(value ^ (value >>> 13), 1103515245)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

const pixels = (cells: [number, number, number, number, string][]) =>
  cells.map(([x, y, width, height, fill], index) => (
    <rect key={index} x={x * PIXEL} y={y * PIXEL} width={width * PIXEL} height={height * PIXEL} fill={fill} />
  ))

const FLOWER_COLORS = ['#f2d14b', '#ece8f4', '#d9534f', '#c77dd8']

const DECORATIONS: Record<Faction, ((pick: number) => ReactNode)[]> = {
  order: [
    (pick) => {
      const petal = FLOWER_COLORS[Math.floor(pick * FLOWER_COLORS.length)]
      return pixels([[0, -1, 1, 1, petal], [-1, 0, 1, 1, petal], [1, 0, 1, 1, petal], [0, 1, 1, 1, petal], [0, 0, 1, 1, '#f5c542']])
    },
    () => pixels([[-1, -2, 1, 2, '#6fa04a'], [0, -3, 1, 3, '#7fb455'], [1, -2, 1, 2, '#6fa04a']]),
    () => pixels([[-2, 0, 4, 1, '#5d8f3f'], [-1, -1, 2, 1, '#5d8f3f']]),
  ],
  undead: [
    () => pixels([[-3, 0, 6, 1, '#d8d2c0'], [-4, -1, 1, 1, '#d8d2c0'], [-4, 1, 1, 1, '#d8d2c0'], [3, -1, 1, 1, '#d8d2c0'], [3, 1, 1, 1, '#d8d2c0']]),
    () => <polyline points="-8,-3 -2,0 2,-2 8,2" fill="none" stroke="#1c1b20" strokeWidth={1.5} />,
    () => <ellipse rx={9} ry={4} fill="#4d4b52" opacity={0.7} />,
    () => pixels([[-2, -2, 1, 1, '#b8b2a0'], [1, -1, 1, 1, '#b8b2a0'], [-1, 1, 1, 1, '#b8b2a0']]),
  ],
  dungeon: [
    () => (
      <>
        <ellipse cx={-3} cy={0} rx={3} ry={2} fill="#7a5f48" />
        <ellipse cx={3} cy={2} rx={2} ry={1.5} fill="#4a3626" />
        <ellipse cx={1} cy={-2} rx={1.5} ry={1} fill="#8a6e54" />
      </>
    ),
    () => <polyline points="-9,1 -4,-1 0,2 5,0 9,-2" fill="none" stroke="#2a1c12" strokeWidth={1.5} />,
    () => <polygon points="-10,-2 -4,-5 6,-4 10,1 3,4 -7,3" fill="#6b4f38" stroke="#2a1c12" strokeWidth={1} />,
    () => (
      <>
        <circle cx={0} cy={-2} r={6} fill="#6fe0d0" opacity={0.18} />
        {pixels([[0, -1, 1, 2, '#d8cfc0'], [-1, -2, 3, 1, '#6fe0d0'], [0, -3, 1, 1, '#a8fff4']])}
      </>
    ),
  ],
}

interface TerrainProps {
  factions: Record<Player, Faction>
  obstacles: Obstacle[]
}

/** The ground under the hexes: Red's homeland on the left, Blue's on the right, blending in the middle. */
export const Terrain = memo(function Terrain({ factions, obstacles }: TerrainProps) {
  const blocked = new Set(obstacles.map((obstacle) => hexKey(obstacle.position)))
  const details: ReactNode[] = []
  for (const hex of allHexes()) {
    const { column } = hexToOffset(hex)
    if (column === MIDDLE_COLUMN || blocked.has(hexKey(hex))) continue
    const choices = DECORATIONS[column < MIDDLE_COLUMN ? factions.red : factions.blue]
    const center = hexToPixel(hex)
    for (let slot = 0; slot < 2; slot++) {
      if (noise(hex.q, hex.r, slot * 3) > 0.45) continue
      const decorate = choices[Math.floor(noise(hex.q, hex.r, slot * 3 + 1) * choices.length)]
      const x = center.x + (noise(hex.q, hex.r, slot * 3 + 2) - 0.5) * 26
      const y = center.y + (slot === 0 ? -8 : 8)
      details.push(
        <g key={`${hexKey(hex)}-${slot}`} transform={`translate(${x.toFixed(1)} ${y})`}>
          {decorate(noise(hex.q, hex.r, slot * 3 + 7))}
        </g>,
      )
    }
  }

  return (
    <g className="terrain" aria-hidden="true">
      <defs>
        <linearGradient id="terrain-sides" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={GROUND[factions.red]} />
          <stop offset="0.44" stopColor={GROUND[factions.red]} />
          <stop offset="0.56" stopColor={GROUND[factions.blue]} />
          <stop offset="1" stopColor={GROUND[factions.blue]} />
        </linearGradient>
        <linearGradient id="terrain-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.06} />
          <stop offset="1" stopColor="#000" stopOpacity={0.35} />
        </linearGradient>
      </defs>
      <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="url(#terrain-sides)" />
      <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="url(#terrain-shade)" />
      {details}
    </g>
  )
})
