import { memo } from 'react'
import { HEROES, type HeroId, type Player, type SpellId } from '../../game'
import { SPELL_ICONS } from './spellIcons'
import { RIDER_SPRITES, SPRITES, type RiderId, type Sprite, type SpriteId } from './sprites'
import { UI_ICONS, type UiIconId } from './uiIcons'

const SPRITE_SIZE = 16

/** Team colors come from the theme, so the reserved characters map to CSS variables. */
const TEAM_COLORS: Record<Player, { main: string; dark: string; light: string }> = {
  red: { main: 'var(--red)', dark: 'var(--red-dark)', light: 'var(--red-light)' },
  blue: { main: 'var(--blue)', dark: 'var(--blue-dark)', light: 'var(--blue-light)' },
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

const RUNS_BY_SPRITE = new WeakMap<Sprite, PixelRun[]>()

function runsFor(sprite: Sprite): PixelRun[] {
  let runs = RUNS_BY_SPRITE.get(sprite)

  if (!runs) {
    runs = pixelRuns(sprite)
    RUNS_BY_SPRITE.set(sprite, runs)
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
  return <PixelArt sprite={SPRITES[spriteId]} owner={owner} size={size} mirrored={mirrored} />
})

/** Which rider each hero class shows on the battlefield. */
const RIDER_BY_CLASS: Record<string, RiderId> = {
  Knight: 'knight',
  Cleric: 'cleric',
  Ranger: 'ranger',
  Druid: 'druid',
  Barbarian: 'barbarian',
  'Battle Mage': 'battleMage',
  'Death Knight': 'deathKnight',
  Necromancer: 'necromancer',
  Overlord: 'overlord',
  Warlock: 'warlock',
  Demoniac: 'demoniac',
  Heretic: 'heretic',
  Alchemist: 'alchemist',
  Wizard: 'wizard',
  Beastmaster: 'beastmaster',
  Witch: 'witch',
  Planeswalker: 'planeswalker',
  Elementalist: 'elementalist',
}

interface MountedHeroProps {
  heroId: HeroId
  owner: Player
  /** The width in board units. */
  size: number
  mirrored?: boolean
}

/** A hero of their class on horseback, holding the team flag as it blows in the wind. Bottom center at (0, 0). */
export const MountedHero = memo(function MountedHero({ heroId, owner, size, mirrored = false }: MountedHeroProps) {
  const rider = RIDER_SPRITES[RIDER_BY_CLASS[HEROES[heroId].title] ?? 'knight']

  // Every frame is drawn, and CSS shows one at a time.
  return (
    <g className="mounted-hero">
      {rider.frames.map((pixels, frame) => (
        <g key={frame} className={`mounted-hero__frame mounted-hero__frame--${frame}`}>
          <PixelArt sprite={{ palette: rider.palette, pixels }} owner={owner} size={size} mirrored={mirrored} />
        </g>
      ))}
    </g>
  )
})

interface PixelArtProps {
  sprite: Sprite
  owner?: Player
  size: number
  mirrored?: boolean
}

/** Draws a sprite of any size, `size` board units wide, with its bottom center at (0, 0). */
function PixelArt({ sprite, owner, size, mirrored = false }: PixelArtProps) {
  const columns = sprite.pixels[0]?.length ?? SPRITE_SIZE
  const rows = sprite.pixels.length
  const pixelSize = size / columns
  const team = owner ? TEAM_COLORS[owner] : { main: '#888', dark: '#444', light: '#bbb' }
  const colorFor = (character: string) =>
    character === 'T' ? team.main : character === 't' ? team.dark : character === 'U' ? team.light : sprite.palette[character]

  return (
    <g
      transform={`scale(${mirrored ? -pixelSize : pixelSize} ${pixelSize}) translate(${-columns / 2} ${-rows})`}
      shapeRendering="crispEdges"
    >
      {runsFor(sprite).map((run) => (
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
}

/** A sprite as a standalone inline SVG, for portraits outside the board. */
export function SpriteIcon({ spriteId, owner, size, mirrored }: SpriteImageProps) {
  return (
    <svg className="sprite-icon" width={size} height={size} viewBox={`${-size / 2} ${-size} ${size} ${size}`} aria-hidden="true">
      <SpriteImage spriteId={spriteId} owner={owner} size={size} mirrored={mirrored} />
    </svg>
  )
}

/** A spell's icon as a standalone inline SVG. */
export function SpellIcon({ spell, size }: { spell: SpellId; size: number }) {
  return (
    <svg className="sprite-icon" width={size} height={size} viewBox={`${-size / 2} ${-size} ${size} ${size}`} aria-hidden="true">
      <PixelArt sprite={SPELL_ICONS[spell]} size={size} />
    </svg>
  )
}

/** A UI icon drawn inside an SVG, with its bottom center at (0, 0). */
export function IconImage({ name, size }: { name: UiIconId; size: number }) {
  return <PixelArt sprite={UI_ICONS[name]} size={size} />
}

/** A UI icon as a standalone inline SVG that sits in a line of text. */
export function Icon({ name, size = 16, label }: { name: UiIconId; size?: number; label?: string }) {
  return (
    <svg
      className="sprite-icon sprite-icon--inline"
      width={size}
      height={size}
      viewBox={`${-size / 2} ${-size} ${size} ${size}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <IconImage name={name} size={size} />
    </svg>
  )
}
