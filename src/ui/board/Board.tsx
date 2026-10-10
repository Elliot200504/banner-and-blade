import { memo, useRef, type MouseEvent } from 'react'
import { allHexes, CREATURES, hasAbility, hexesOf, hexKey, inBounds, OBSTACLES_BY_FACTION, sameHex, type Corpse, type CreatureType, type Faction, type Hex, type HeroId, type Obstacle, type Player, type Unit } from '../../game'
import { BOARD_HEIGHT, BOARD_WIDTH, HERO_POINTS, HERO_SIZE, HEX_SIZE, hexCorners, hexToPixel, pixelToHex, standPoint, type Point } from './layout'
import { IconImage, MountedHero, SpriteImage } from '../art/SpriteImage'
import { SPRITES } from '../art/sprites'
import { Terrain } from './Terrain'
import { Ambience } from './Ambience'
import type { Theme } from '../hooks/useTheme'
import type { FloatingText, Pose, Projectile, ProjectileKind } from './useAnimator'

const UNIT_SPRITE_SIZE = 44

/**
 * How wide a creature is drawn: every sprite pixel is the same size, so the wide creatures' 24-pixel sprites
 * stretch across both their hexes while standing no taller than anyone else.
 */
const spriteWidth = (type: CreatureType) => (UNIT_SPRITE_SIZE * SPRITES[type].pixels[0].length) / 16
const OBSTACLE_SPRITE_SIZE = 40

/** A unit as it should be drawn right now (animation overrides already applied). */
export interface DisplayUnit {
  unit: Unit
  point: Point
  count: number
  topHp: number
  hit: boolean
  dying: boolean
  glow: string
  /** Striking or shooting right now. */
  pose?: Pose | null
  /** Drawn as a question mark, for a side picked at random that is still a secret. */
  secret?: boolean
}

export interface BoardHighlights {
  activeUnitId: string | null
  reachable: Set<string>
  /** Hexes within the active shooter's range. */
  inRange: Set<string>
  pathPreview: Hex[]
  attackOrigin: Hex | null
  targetUnitIds: Set<string>
  /** Stacks a pending spell can be cast on. */
  spellTargetIds: Set<string>
  /** A stack highlighted from outside the board (e.g. hovering the turn queue). */
  spotlightUnitId: string | null
  hoveredHex: Hex | null
  selectedHex: Hex | null
}

interface BoardProps {
  units: DisplayUnit[]
  obstacles: Obstacle[]
  /** Whose homeland each half of the field is. */
  factions: Record<Player, Faction>
  highlights: BoardHighlights
  projectile: Projectile | null
  lightning: Point | null
  floatingTexts: FloatingText[]
  cursor: string
  theme: Theme
  onPointerMove: (hex: Hex | null, point: Point | null) => void
  onBoardClick: (hex: Hex, point: Point) => void
  onBoardRightClick: (hex: Hex) => void
  /** The part of the board to show, as an SVG viewBox. The whole board when left out. */
  viewBox?: string
  /** The stacks that have fallen, lying where they died. */
  corpses?: Corpse[]
  /** The heroes watching from their side of the field. A side left out has no one there. */
  heroes?: Partial<Record<Player, HeroId>>
}

const HEXES = allHexes()

export function Board(props: BoardProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { highlights } = props

  const toBoardPoint = (event: MouseEvent): Point | null => {
    const svg = svgRef.current
    const matrix = svg?.getScreenCTM()

    if (!svg || !matrix) {
      return null
    }

    const screenPoint = svg.createSVGPoint()
    screenPoint.x = event.clientX
    screenPoint.y = event.clientY
    const boardPoint = screenPoint.matrixTransform(matrix.inverse())

    return { x: boardPoint.x, y: boardPoint.y }
  }

  const hexUnderPointer = (event: MouseEvent): { hex: Hex; point: Point } | null => {
    const point = toBoardPoint(event)

    if (!point) {
      return null
    }

    const hex = pixelToHex(point)

    return inBounds(hex) ? { hex, point } : null
  }

  const handleMouseMove = (event: MouseEvent) => {
    const hit = hexUnderPointer(event)
    props.onPointerMove(hit?.hex ?? null, hit?.point ?? null)
  }

  const handleClick = (event: MouseEvent) => {
    const hit = hexUnderPointer(event)

    if (hit) {
      props.onBoardClick(hit.hex, hit.point)
    }
  }

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    const hit = hexUnderPointer(event)

    if (hit) {
      props.onBoardRightClick(hit.hex)
    }
  }

  const pathKeys = new Set(highlights.pathPreview.map(hexKey))
  const activeUnit = props.units.find((displayUnit) => displayUnit.unit.id === highlights.activeUnitId)?.unit
  const activeHexes = new Set(activeUnit ? hexesOf(activeUnit).map(hexKey) : [])
  const sortedUnits = [...props.units].sort((first, second) => first.point.y - second.point.y)

  return (
    <svg
      ref={svgRef}
      className="board"
      viewBox={props.viewBox ?? `0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
      style={{ cursor: props.cursor }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => props.onPointerMove(null, null)}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <Terrain factions={props.factions} obstacles={props.obstacles} neon={props.theme === 'synthwave'} />

      {HEXES.map((hex) => {
        const key = hexKey(hex)
        let className = 'hex'

        if (highlights.inRange.has(key)) {
          className += ' hex--in-range'
        }

        if (highlights.reachable.has(key)) {
          className += ' hex--reachable'
        }

        if (pathKeys.has(key)) {
          className += ' hex--path'
        }

        if (activeHexes.has(key)) {
          className += ' hex--active'
        }

        if (highlights.attackOrigin && sameHex(highlights.attackOrigin, hex)) {
          className += ' hex--origin'
        }

        if (highlights.selectedHex && sameHex(highlights.selectedHex, hex)) {
          className += ' hex--selected'
        }

        if (highlights.hoveredHex && sameHex(highlights.hoveredHex, hex)) {
          className += ' hex--hovered'
        }

        return <polygon key={key} className={className} points={hexCorners(hexToPixel(hex), HEX_SIZE - 1)} />
      })}

      {props.obstacles.map((obstacle) => {
        const center = hexToPixel(obstacle.position)
        // In Synthwave, each homeland's obstacles become holograms in that homeland's neon.
        const homeland = OBSTACLES_BY_FACTION[props.factions.red].includes(obstacle.kind) ? props.factions.red : props.factions.blue
        const hologram = props.theme === 'synthwave' ? `url(#neon-${homeland})` : undefined

        return (
          <g key={hexKey(obstacle.position)} transform={`translate(${center.x} ${center.y + 16})`}>
            <ellipse cx={0} cy={-2} rx={18} ry={5} fill="rgba(0,0,0,0.35)" />
            <g filter={hologram}>
              <SpriteImage spriteId={obstacle.kind} size={OBSTACLE_SPRITE_SIZE} />
            </g>
          </g>
        )
      })}

      {props.corpses?.map((corpse, index) => (
        <CorpseShape key={index} corpse={corpse} />
      ))}

      <Ambience factions={props.factions} />

      {(['red', 'blue'] as const).map((player) => {
        const heroId = props.heroes?.[player]

        return (
          heroId && (
            <g key={player} className="board-hero" transform={`translate(${HERO_POINTS[player].x} ${HERO_POINTS[player].y})`}>
              <ellipse cx={0} cy={-1} rx={HERO_SIZE * 0.36} ry={4} fill="rgba(0,0,0,0.4)" />
              <MountedHero heroId={heroId} owner={player} size={HERO_SIZE} mirrored={player === 'blue'} />
            </g>
          )
        )
      })}

      {sortedUnits.map((displayUnit) => (
        <UnitToken
          key={displayUnit.unit.id}
          displayUnit={displayUnit}
          active={displayUnit.unit.id === highlights.activeUnitId}
          targeted={highlights.targetUnitIds.has(displayUnit.unit.id)}
          spellTarget={highlights.spellTargetIds.has(displayUnit.unit.id)}
          spotlight={displayUnit.unit.id === highlights.spotlightUnitId}
        />
      ))}

      {props.projectile && <ProjectileShape projectile={props.projectile} />}

      {props.lightning && (
        <polyline
          className="lightning"
          points={`${props.lightning.x + 10},0 ${props.lightning.x - 12},${props.lightning.y * 0.4} ${props.lightning.x + 8},${props.lightning.y * 0.6} ${props.lightning.x - 6},${props.lightning.y * 0.85} ${props.lightning.x},${props.lightning.y}`}
        />
      )}

      {props.floatingTexts.map((floating) => (
        <g key={floating.id} transform={`translate(${floating.position.x} ${floating.position.y - 34})`}>
          <text className={`floating-text floating-text--${floating.tone}`} textAnchor="middle">
            {floating.text}
          </text>
        </g>
      ))}
    </svg>
  )
}

const PROJECTILE_COLORS: Record<ProjectileKind, string> = {
  arrow: 'var(--projectile-shaft)',
  holy: '#fde68a',
  death: '#4ade80',
  magic: '#93c5fd',
  fire: '#fb923c',
}

function ProjectileShape({ projectile }: { projectile: Projectile }) {
  const { position, angle, kind } = projectile

  return (
    <g transform={`translate(${position.x} ${position.y - 18}) rotate(${angle})`}>
      {kind === 'arrow' ? (
        <>
          <line className="projectile__shaft" x1={-12} y1={0} x2={6} y2={0} />
          <polygon className="projectile__head" points="6,-4 13,0 6,4" />
        </>
      ) : (
        <>
          <circle r={9} fill={PROJECTILE_COLORS[kind]} opacity={0.35} />
          <circle r={5} fill={PROJECTILE_COLORS[kind]} />
          <circle r={2} fill="#fff" />
        </>
      )}
    </g>
  )
}

/** A steady number between 0 and 1 for each stack, so its idle animation keeps its own rhythm. */
function idleOffset(unitId: string): number {
  let hash = 0

  for (const character of unitId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return (hash % 1000) / 1000
}

/** A fallen stack: its creature lying on its back where it died, faded into the ground. */
const CorpseShape = memo(function CorpseShape({ corpse }: { corpse: Corpse }) {
  const point = standPoint(corpse)
  const facing = corpse.owner === 'red' ? 1 : -1

  // The same pose a dying stack topples into, so the body takes over where the death leaves off.
  return (
    <g className="corpse" transform={`translate(${point.x} ${point.y + 20}) rotate(${-85 * facing}) scale(0.9)`}>
      <SpriteImage
        spriteId={corpse.type}
        owner={corpse.owner}
        size={spriteWidth(corpse.type)}
        mirrored={corpse.owner === 'blue'}
      />
    </g>
  )
})

interface UnitTokenProps {
  displayUnit: DisplayUnit
  active: boolean
  targeted: boolean
  spellTarget: boolean
  spotlight: boolean
}

const UnitToken = memo(function UnitToken({ displayUnit, active, targeted, spellTarget, spotlight }: UnitTokenProps) {
  const { unit, point, count, topHp, hit, dying, glow, pose, secret } = displayUnit
  const maxHp = CREATURES[unit.type].hp
  const hpFraction = topHp / maxHp
  const hpColor = hpFraction > 0.6 ? '#22c55e' : hpFraction > 0.3 ? '#eab308' : '#ef4444'
  const barWidth = 26
  const hasBuff = unit.effects.some((active) => ['haste', 'bless', 'stoneSkin'].includes(active.effect))
  const hasDebuff = unit.effects.some((active) => ['slow', 'curse'].includes(active.effect))

  let className = `unit unit--${unit.owner}`

  if (hit) {
    className += ' unit--hit'
  }

  if (dying) {
    className += ' unit--dying'
  }

  if (spotlight) {
    className += ' unit--spotlight'
  }

  if (unit.petrified) {
    className += ' unit--petrified'
  }

  if (pose) {
    className += ` unit--${pose}`
  }

  // Fliers hover, everyone else breathes; each stack starts at its own point so they don't move in step.
  if (hasAbility(unit.type, 'flying')) {
    className += ' unit--flier'
  }

  const idleDelay = `${-(idleOffset(unit.id) * 3).toFixed(2)}s`
  const wide = hasAbility(unit.type, 'wide')
  const ringWidth = wide ? 38 : 20
  // The count sits beside the creature, further out for a wide one.
  const countOffset = wide ? 16 : 0

  return (
    <g className={className} transform={`translate(${point.x} ${point.y})`}>
      {active && <ellipse className="unit__active-ring" cx={0} cy={12} rx={ringWidth} ry={7} />}
      {targeted && <ellipse className="unit__target-ring" cx={0} cy={12} rx={ringWidth} ry={7} />}
      {spellTarget && <ellipse className="unit__spell-ring" cx={0} cy={12} rx={ringWidth} ry={7} />}
      {glow && <circle cx={0} cy={-8} r={wide ? 34 : 24} style={{ fill: glow }} className="unit__glow" />}
      <ellipse cx={0} cy={13} rx={wide ? 30 : 15} ry={wide ? 5 : 4} fill="rgba(0,0,0,0.4)" />
      {secret ? (
        <text className="unit__secret" x={0} y={-6} textAnchor="middle" dominantBaseline="central">
          ?
        </text>
      ) : (
        <g className="unit__sprite" transform="translate(0 14)">
          <g className="unit__pose">
            <g className="unit__idle" style={{ animationDelay: idleDelay }}>
              <SpriteImage
                spriteId={unit.type}
                owner={unit.owner}
                size={spriteWidth(unit.type)}
                mirrored={unit.owner === 'blue'}
              />
            </g>
          </g>
        </g>
      )}
      {unit.defending && (
        <g transform={`translate(${unit.owner === 'red' ? -16 : 16} -14)`}>
          <IconImage name="defense" size={16} />
        </g>
      )}
      <g transform={`translate(${unit.owner === 'red' ? 6 + countOffset : -30 - countOffset} 8)`}>
        <rect
          className={`unit__count-box${hasBuff ? ' unit__count-box--buffed' : ''}${hasDebuff ? ' unit__count-box--debuffed' : ''}`}
          width={24}
          height={11}
        />
        <text className="unit__count" x={12} y={6} textAnchor="middle" dominantBaseline="central">
          {secret ? '?' : count}
        </text>
      </g>
      <rect className="unit__hp-background" x={-barWidth / 2 - 1} y={20} width={barWidth + 2} height={4} />
      <rect x={-barWidth / 2} y={21} width={barWidth * hpFraction} height={2} fill={hpColor} />
    </g>
  )
})
