import { memo, type ReactNode } from 'react'
import { COLUMNS, hexKey, inBounds, offsetToHex, ROWS, type Faction, type Hex, type Obstacle, type Player } from '../../game'
import { BOARD_HEIGHT, BOARD_WIDTH, hexToPixel } from './layout'

/** Ground colors: each army fights on its own homeland's half of the field. */
const GROUND: Record<Faction, string> = {
  castle: '#4c7a33',
  rampart: '#2f6b35',
  stronghold: '#8a7344',
  necropolis: '#323238',
  dungeon: '#5a412c',
  inferno: '#4a1c16',
  tower: '#9aa6b4',
  fortress: '#3e4a2a',
  conflux: '#6e9e4c',
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

const LEAF_COLORS = ['#3f8a3a', '#5aa83f', '#2c6a2e', '#c8a032']

const DECORATIONS: Record<Faction, ((pick: number) => ReactNode)[]> = {
  rampart: [
    () => pixels([[-1, -2, 1, 2, '#4a9a3c'], [0, -3, 1, 3, '#62b64a'], [1, -2, 1, 2, '#4a9a3c'], [-2, -1, 1, 1, '#4a9a3c']]),
    (pick) => {
      const leaf = LEAF_COLORS[Math.floor(pick * LEAF_COLORS.length)]

      return pixels([[0, 0, 2, 1, leaf], [-1, 1, 2, 1, leaf]])
    },
    () => pixels([[0, -1, 1, 1, '#f4f0f8'], [-1, 0, 1, 1, '#f4f0f8'], [1, 0, 1, 1, '#f4f0f8'], [0, 0, 1, 1, '#f2d14b'], [0, 1, 1, 2, '#3f8a3a']]),
    () => <ellipse rx={8} ry={3} fill="#24572a" opacity={0.6} />,
  ],
  stronghold: [
    () => pixels([[-2, -2, 1, 2, '#b89a58'], [0, -3, 1, 3, '#c8aa62'], [2, -2, 1, 2, '#a88a48']]),
    () => (
      <>
        <ellipse cx={-2} cy={0} rx={2} ry={1.5} fill="#a08858" />
        <ellipse cx={2} cy={1} rx={1.5} ry={1} fill="#6e5a36" />
      </>
    ),
    () => <polyline points="-8,0 -3,2 1,-1 7,1" fill="none" stroke="#5e4a2a" strokeWidth={1.5} />,
    () => pixels([[-3, 0, 6, 1, '#e8e0c8'], [-4, -1, 1, 1, '#e8e0c8'], [3, -1, 1, 1, '#e8e0c8']]),
  ],
  inferno: [
    () => <polyline points="-9,0 -4,-2 0,1 4,-1 9,1" fill="none" stroke="#ff7a1a" strokeWidth={1.5} opacity={0.85} />,
    () => (
      <>
        <circle r={4} fill="#ff5a14" opacity={0.2} />
        {pixels([[0, -1, 1, 1, '#ffd040'], [-1, 0, 3, 1, '#ff7a1a']])}
      </>
    ),
    () => <polygon points="-8,-1 -3,-4 5,-3 8,1 2,3 -6,2" fill="#2a100c" stroke="#120604" strokeWidth={1} />,
    () => pixels([[-2, 0, 1, 1, '#8a8078'], [1, -1, 1, 1, '#6a625a'], [0, 1, 1, 1, '#8a8078']]),
  ],
  castle: [
    (pick) => {
      const petal = FLOWER_COLORS[Math.floor(pick * FLOWER_COLORS.length)]

      return pixels([[0, -1, 1, 1, petal], [-1, 0, 1, 1, petal], [1, 0, 1, 1, petal], [0, 1, 1, 1, petal], [0, 0, 1, 1, '#f5c542']])
    },
    () => pixels([[-1, -2, 1, 2, '#6fa04a'], [0, -3, 1, 3, '#7fb455'], [1, -2, 1, 2, '#6fa04a']]),
    () => pixels([[-2, 0, 4, 1, '#5d8f3f'], [-1, -1, 2, 1, '#5d8f3f']]),
  ],
  necropolis: [
    () => pixels([[-3, 0, 6, 1, '#d8d2c0'], [-4, -1, 1, 1, '#d8d2c0'], [-4, 1, 1, 1, '#d8d2c0'], [3, -1, 1, 1, '#d8d2c0'], [3, 1, 1, 1, '#d8d2c0']]),
    () => <polyline points="-8,-3 -2,0 2,-2 8,2" fill="none" stroke="#1c1b20" strokeWidth={1.5} />,
    () => <ellipse rx={9} ry={4} fill="#4d4b52" opacity={0.7} />,
    () => pixels([[-2, -2, 1, 1, '#b8b2a0'], [1, -1, 1, 1, '#b8b2a0'], [-1, 1, 1, 1, '#b8b2a0']]),
  ],
  tower: [
    () => pixels([[-3, 0, 6, 1, '#e8eef4'], [-2, -1, 4, 1, '#f4f8fc']]),
    () => pixels([[0, -1, 1, 1, '#c8e4f4'], [-1, 0, 3, 1, '#a8d0e8'], [0, 1, 1, 1, '#c8e4f4']]),
    () => <ellipse rx={9} ry={3} fill="#c2ccd8" opacity={0.7} />,
    () => <polyline points="-8,0 -3,-1 2,1 8,-1" fill="none" stroke="#7a8698" strokeWidth={1.5} />,
  ],
  fortress: [
    () => <ellipse rx={9} ry={4} fill="#2a3a24" opacity={0.75} />,
    () => pixels([[-2, -3, 1, 3, '#6a8a3a'], [0, -4, 1, 4, '#7a9a44'], [2, -2, 1, 2, '#5a7a32'], [0, -5, 1, 1, '#8a5a2b']]),
    () => (
      <>
        <ellipse cx={-2} cy={0} rx={3} ry={1.5} fill="#5a6a3a" />
        <circle cx={2} cy={-1} r={1} fill="#9ab060" opacity={0.6} />
      </>
    ),
    () => pixels([[-1, 0, 3, 1, '#4a5a2a'], [1, -1, 1, 1, '#4a5a2a']]),
  ],
  // Conflux stands on bright grassland, lit by its four elements.
  conflux: [
    () => pixels([[0, -1, 1, 1, '#ffffff'], [-1, 0, 1, 1, '#ffffff'], [1, 0, 1, 1, '#ffffff'], [0, 1, 1, 1, '#ffffff'], [0, 0, 1, 1, '#ffe680']]),
    () => pixels([[-1, -2, 1, 2, '#8ac460'], [0, -3, 1, 3, '#a0d470'], [1, -2, 1, 2, '#8ac460']]),
    (pick) => {
      const element = ['#ff9a4a', '#5ac8ff', '#f4fbff', '#c8a060'][Math.floor(pick * 4)]

      return (
        <>
          <circle r={3} fill={element} opacity={0.25} />
          {pixels([[0, 0, 1, 1, element]])}
        </>
      )
    },
    () => pixels([[0, -2, 1, 2, '#d8f4ff'], [-1, 0, 3, 1, '#a8dcf0'], [0, 1, 1, 1, '#88c0d8']]),
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

/** Synthwave: each homeland as a dark ground with its own neon color. */
const NEON_GROUND: Record<Faction, string> = {
  castle: '#0b1a3a',
  rampart: '#062a1c',
  stronghold: '#2a1606',
  necropolis: '#1a0b2e',
  dungeon: '#2a0828',
  inferno: '#2e0606',
  tower: '#0a1a2a',
  fortress: '#0e1a08',
  conflux: '#0f1e0c',
}

const NEON: Record<Faction, string> = {
  castle: '#38bdf8',
  rampart: '#34f5a0',
  stronghold: '#ffb020',
  necropolis: '#b46bff',
  dungeon: '#ff4fd8',
  inferno: '#ff3a3a',
  tower: '#7ae0ff',
  fortress: '#a8e030',
  conflux: '#d8ffa0',
}

/** One small faction glyph per homeland, drawn in its neon color among the circuit traces. */
const NEON_GLYPHS: Record<Faction, (color: string) => ReactNode> = {
  castle: (color) => <polygon points="0,-3 3,0 0,3 -3,0" fill="none" stroke={color} strokeWidth={1} />,
  rampart: (color) => <polyline points="-3,2 0,-3 3,2" fill="none" stroke={color} strokeWidth={1} />,
  stronghold: (color) => <polygon points="0,-3 3,2 -3,2" fill="none" stroke={color} strokeWidth={1} />,
  necropolis: (color) => <path d="M0,-3 V3 M-2,-1 H2" stroke={color} strokeWidth={1} />,
  dungeon: (color) => (
    <>
      <ellipse rx={3.5} ry={2} fill="none" stroke={color} strokeWidth={1} />
      <circle r={1} fill={color} />
    </>
  ),
  inferno: (color) => <polyline points="-3,2 -1,-1 0,1 1,-3 3,2" fill="none" stroke={color} strokeWidth={1} />,
  tower: (color) => <path d="M0,-3 V3 M-3,0 H3 M-2,-2 L2,2 M2,-2 L-2,2" stroke={color} strokeWidth={0.8} />,
  fortress: (color) => <path d="M-3,1 Q-1.5,-2 0,1 Q1.5,-2 3,1" fill="none" stroke={color} strokeWidth={1} />,
  conflux: (color) => <rect x={-2} y={-2} width={4} height={4} transform="rotate(45)" fill="none" stroke={color} strokeWidth={1} />,
}

const NEON_DECORATIONS: ((color: string, faction: Faction) => ReactNode)[] = [
  (color) => (
    <>
      <polyline points="-9,0 -3,0 1,-4 8,-4" fill="none" stroke={color} strokeWidth={1} opacity={0.55} />
      <circle cx={8} cy={-4} r={1.5} fill={color} />
    </>
  ),
  (color) => (
    <>
      <circle r={4} fill={color} opacity={0.15} />
      <circle r={1.5} fill={color} />
    </>
  ),
  (color, faction) => <g opacity={0.8}>{NEON_GLYPHS[faction](color)}</g>,
  (color) => (
    <>
      <polyline points="-8,3 -8,-1 4,-1 4,-4" fill="none" stroke={color} strokeWidth={1} opacity={0.45} />
      <rect x={3} y={-5} width={2} height={2} fill={color} />
    </>
  ),
]

/** Grid spacing of the glowing floor lines in Synthwave. */
const NEON_GRID = 24

/**
 * Turns a sprite into a glowing one-color hologram: brightness becomes the neon color, then a soft glow.
 * Obstacles in Synthwave use these, by id `neon-<faction>`.
 */
function NeonFilter({ faction }: { faction: Faction }) {
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(NEON[faction].slice(start, start + 2), 16) / 255)
  const row = (channel: number) => `${0.3 * channel * 2.6} ${0.59 * channel * 2.6} ${0.11 * channel * 2.6} 0 ${channel * 0.15}`

  return (
    <filter id={`neon-${faction}`} x="-30%" y="-30%" width="160%" height="160%">
      <feColorMatrix type="matrix" values={`${row(red)} ${row(green)} ${row(blue)} 0 0 0 1 0`} result="tinted" />
      <feGaussianBlur in="tinted" stdDeviation={2} result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="tinted" />
      </feMerge>
    </filter>
  )
}

/** A place for ground details: one per hex, also on imagined hexes past the edges, so the open ground the heroes and the turn order stand on is dressed too. */
interface GroundSpot {
  hex: Hex
  key: string
  side: Player
}

/** How far past the hexes the spots reach, in hexes: the hero bands on the sides and the strip below. */
const SPOT_REACH = { sides: 2, below: 3 }

function groundSpots(obstacles: Obstacle[]): GroundSpot[] {
  const blocked = new Set(obstacles.map((obstacle) => hexKey(obstacle.position)))
  const spots: GroundSpot[] = []

  for (let row = -1; row < ROWS + SPOT_REACH.below; row++) {
    for (let column = -SPOT_REACH.sides; column < COLUMNS + SPOT_REACH.sides; column++) {
      const hex = offsetToHex(column, row)
      const center = hexToPixel(hex)
      const onBoard = center.x > 0 && center.x < BOARD_WIDTH && center.y > 0 && center.y < BOARD_HEIGHT

      if (!onBoard || column === MIDDLE_COLUMN || (inBounds(hex) && blocked.has(hexKey(hex)))) {
        continue
      }

      spots.push({ hex, key: hexKey(hex), side: column < MIDDLE_COLUMN ? 'red' : 'blue' })
    }
  }

  return spots
}

interface TerrainProps {
  factions: Record<Player, Faction>
  obstacles: Obstacle[]
  /** Draw the Synthwave version: neon grid and circuit traces instead of grass and stones. */
  neon?: boolean
}

/** The ground under the hexes: Red's homeland on the left, Blue's on the right, blending in the middle. */
export const Terrain = memo(function Terrain({ factions, obstacles, neon = false }: TerrainProps) {
  if (neon) {
    return <NeonTerrain factions={factions} obstacles={obstacles} />
  }

  const details: ReactNode[] = []

  for (const { hex, key, side } of groundSpots(obstacles)) {
    const choices = DECORATIONS[factions[side]]
    const center = hexToPixel(hex)

    for (let slot = 0; slot < 2; slot++) {
      if (noise(hex.q, hex.r, slot * 3) > 0.45) {
        continue
      }

      const decorate = choices[Math.floor(noise(hex.q, hex.r, slot * 3 + 1) * choices.length)]
      const x = center.x + (noise(hex.q, hex.r, slot * 3 + 2) - 0.5) * 26
      const y = center.y + (slot === 0 ? -8 : 8)
      details.push(
        <g key={`${key}-${slot}`} transform={`translate(${x.toFixed(1)} ${y})`}>
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

/** Synthwave ground: each homeland in its own neon, with a glowing floor grid and circuit traces. */
function NeonTerrain({ factions, obstacles }: Omit<TerrainProps, 'neon'>) {
  const details: ReactNode[] = []

  for (const { hex, key, side } of groundSpots(obstacles)) {
    if (noise(hex.q, hex.r, 0) > 0.4) {
      continue
    }

    const faction = factions[side]
    const decorate = NEON_DECORATIONS[Math.floor(noise(hex.q, hex.r, 1) * NEON_DECORATIONS.length)]
    const center = hexToPixel(hex)
    const x = center.x + (noise(hex.q, hex.r, 2) - 0.5) * 20
    const y = center.y + (noise(hex.q, hex.r, 3) - 0.5) * 16
    details.push(
      <g key={key} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
        {decorate(NEON[faction], faction)}
      </g>,
    )
  }

  const gridLines: ReactNode[] = []

  for (let x = NEON_GRID; x < BOARD_WIDTH; x += NEON_GRID) {
    const color = x < BOARD_WIDTH / 2 ? NEON[factions.red] : NEON[factions.blue]
    gridLines.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={BOARD_HEIGHT} stroke={color} />)
  }

  for (let y = NEON_GRID; y < BOARD_HEIGHT; y += NEON_GRID) {
    gridLines.push(<line key={`y${y}`} x1={0} y1={y} x2={BOARD_WIDTH} y2={y} stroke="url(#neon-sides)" />)
  }

  return (
    <g className="terrain terrain--neon" aria-hidden="true">
      <defs>
        <linearGradient id="neon-ground" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={NEON_GROUND[factions.red]} />
          <stop offset="0.44" stopColor={NEON_GROUND[factions.red]} />
          <stop offset="0.56" stopColor={NEON_GROUND[factions.blue]} />
          <stop offset="1" stopColor={NEON_GROUND[factions.blue]} />
        </linearGradient>
        <linearGradient id="neon-sides" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={BOARD_WIDTH} y2={0}>
          <stop offset="0" stopColor={NEON[factions.red]} />
          <stop offset="0.44" stopColor={NEON[factions.red]} />
          <stop offset="0.56" stopColor={NEON[factions.blue]} />
          <stop offset="1" stopColor={NEON[factions.blue]} />
        </linearGradient>
        <radialGradient id="neon-vignette" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.5" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.55} />
        </radialGradient>
        <NeonFilter faction={factions.red} />
        {factions.blue !== factions.red && <NeonFilter faction={factions.blue} />}
      </defs>
      <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="url(#neon-ground)" />
      <g strokeWidth={1} opacity={0.25}>
        {gridLines}
      </g>
      {details}
      <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="url(#neon-vignette)" />
    </g>
  )
}
