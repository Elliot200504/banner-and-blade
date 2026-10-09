import { memo } from 'react'
import type { Player } from '../game'
import { SPRITES, type Sprite, type SpriteId } from './sprites'

const SPRITE_SIZE = 16

/** Team colors come from the theme, so the reserved characters map to CSS variables. */
const TEAM_COLORS: Record<Player, { main: string; dark: string }> = {
  red: { main: 'var(--red)', dark: 'var(--red-dark)' },
  blue: { main: 'var(--blue)', dark: 'var(--blue-dark)' },
}

interface PixelRun {
  row: number
  column: number
  length: number
  character: string
}

/** Merges neighbouring pixels of the same color into one rect each, to keep the SVG small. */
function pixelRuns(sprite: Sprite): PixelRun[] {
  const runs: PixelRun[] = []
  sprite.pixels.forEach((line, row) => {
    let column = 0

    while (column < line.length) {
      const character = line[column]
      let length = 1

      while (line[column + length] === character) {
        length++
      }

      if (character !== '.') {
        runs.push({ row, column, length, character })
      }

      column += length
    }
  })

  return runs
}

const RUNS_BY_SPRITE = new Map<SpriteId, PixelRun[]>()

function runsFor(spriteId: SpriteId): PixelRun[] {
  let runs = RUNS_BY_SPRITE.get(spriteId)

  if (!runs) {
    runs = pixelRuns(SPRITES[spriteId])
    RUNS_BY_SPRITE.set(spriteId, runs)
  }

  return runs
}

interface SpriteImageProps {
  spriteId: SpriteId
  /** Whose team colors to use. Obstacles have no owner. */
  owner?: Player
  /** Width and height in board units. */
  size: number
  /** Mirror horizontally (sprites face right). */
  mirrored?: boolean
}

/** Draws a sprite with its bottom center at (0, 0). */
export const SpriteImage = memo(function SpriteImage({ spriteId, owner, size, mirrored = false }: SpriteImageProps) {
  const sprite = SPRITES[spriteId]
  const pixelSize = size / SPRITE_SIZE
  const team = owner ? TEAM_COLORS[owner] : { main: '#888', dark: '#444' }
  const colorFor = (character: string) =>
    character === 'T' ? team.main : character === 't' ? team.dark : sprite.palette[character]


  return (
    <g
      transform={`scale(${mirrored ? -pixelSize : pixelSize} ${pixelSize}) translate(${-SPRITE_SIZE / 2} ${-SPRITE_SIZE})`}
      shapeRendering="crispEdges"
    >
      {runsFor(spriteId).map((run) => (
        <rect
          key={`${run.row}-${run.column}`}
          x={run.column}
          y={run.row}
          width={run.length}
          height={1}
          style={{ fill: colorFor(run.character) }}
        />
      ))}
    </g>
  )
})

/** A sprite as a standalone inline SVG, for portraits outside the board. */
export function SpriteIcon({ spriteId, owner, size, mirrored }: SpriteImageProps) {
  return (
    <svg className="sprite-icon" width={size} height={size} viewBox={`${-size / 2} ${-size} ${size} ${size}`} aria-hidden="true">
      <SpriteImage spriteId={spriteId} owner={owner} size={size} mirrored={mirrored} />
    </svg>
  )
}
