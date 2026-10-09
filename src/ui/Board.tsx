import { memo, useRef, type MouseEvent } from 'react'
import { allHexes, CREATURES, hexKey, inBounds, sameHex, type Hex, type Obstacle, type Unit } from '../game'
import { BOARD_HEIGHT, BOARD_WIDTH, HEX_SIZE, hexCorners, hexToPixel, pixelToHex, type Point } from './layout'
import { SpriteImage } from './SpriteImage'
import type { SpriteId } from './sprites'
import type { Theme } from './useTheme'
import type { FloatingText, Projectile, ProjectileKind } from './useAnimator'

const UNIT_SPRITE_SIZE = 44
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
  highlights: BoardHighlights
  projectile: Projectile | null
  lightning: Point | null
  floatingTexts: FloatingText[]
  cursor: string
  theme: Theme
  onPointerMove: (hex: Hex | null, point: Point | null) => void
  onBoardClick: (hex: Hex, point: Point) => void
  onBoardRightClick: (hex: Hex) => void
}

const HEXES = allHexes()

export function Board(props: BoardProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { highlights } = props

  const toBoardPoint = (event: MouseEvent): Point | null => {
    const svg = svgRef.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return null
    const screenPoint = svg.createSVGPoint()
    screenPoint.x = event.clientX
    screenPoint.y = event.clientY
    const boardPoint = screenPoint.matrixTransform(matrix.inverse())
    return { x: boardPoint.x, y: boardPoint.y }
  }

  const hexUnderPointer = (event: MouseEvent): { hex: Hex; point: Point } | null => {
    const point = toBoardPoint(event)
    if (!point) return null
    const hex = pixelToHex(point)
    return inBounds(hex) ? { hex, point } : null
  }

  const handleMouseMove = (event: MouseEvent) => {
    const hit = hexUnderPointer(event)
    props.onPointerMove(hit?.hex ?? null, hit?.point ?? null)
  }

  const handleClick = (event: MouseEvent) => {
    const hit = hexUnderPointer(event)
    if (hit) props.onBoardClick(hit.hex, hit.point)
  }

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    const hit = hexUnderPointer(event)
    if (hit) props.onBoardRightClick(hit.hex)
  }

  const pathKeys = new Set(highlights.pathPreview.map(hexKey))
  const activeHex = props.units.find((displayUnit) => displayUnit.unit.id === highlights.activeUnitId)?.unit.position
  const sortedUnits = [...props.units].sort((first, second) => first.point.y - second.point.y)

  return (
    <svg
      ref={svgRef}
      className="board"
      viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
      style={{ cursor: props.cursor }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => props.onPointerMove(null, null)}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <defs>
        <linearGradient id="field" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--board-top)' }} />
          <stop offset="1" style={{ stopColor: 'var(--board-bottom)' }} />
        </linearGradient>
      </defs>
      <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="url(#field)" />

      {HEXES.map((hex) => {
        const key = hexKey(hex)
        let className = 'hex'
        if (highlights.inRange.has(key)) className += ' hex--in-range'
        if (highlights.reachable.has(key)) className += ' hex--reachable'
        if (pathKeys.has(key)) className += ' hex--path'
        if (activeHex && sameHex(activeHex, hex)) className += ' hex--active'
        if (highlights.attackOrigin && sameHex(highlights.attackOrigin, hex)) className += ' hex--origin'
        if (highlights.selectedHex && sameHex(highlights.selectedHex, hex)) className += ' hex--selected'
        if (highlights.hoveredHex && sameHex(highlights.hoveredHex, hex)) className += ' hex--hovered'
        return <polygon key={key} className={className} points={hexCorners(hexToPixel(hex), HEX_SIZE - 1)} />
      })}

      {props.obstacles.map((obstacle) => {
        const center = hexToPixel(obstacle.position)
        const spriteId: SpriteId = props.theme === 'synthwave' ? 'crystal' : obstacle.kind
        return (
          <g key={hexKey(obstacle.position)} transform={`translate(${center.x} ${center.y + 16})`}>
            <ellipse cx={0} cy={-2} rx={18} ry={5} fill="rgba(0,0,0,0.35)" />
            <SpriteImage spriteId={spriteId} size={OBSTACLE_SPRITE_SIZE} />
          </g>
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

interface UnitTokenProps {
  displayUnit: DisplayUnit
  active: boolean
  targeted: boolean
  spellTarget: boolean
  spotlight: boolean
}

const UnitToken = memo(function UnitToken({ displayUnit, active, targeted, spellTarget, spotlight }: UnitTokenProps) {
  const { unit, point, count, topHp, hit, dying, glow } = displayUnit
  const maxHp = CREATURES[unit.type].hp
  const hpFraction = topHp / maxHp
  const hpColor = hpFraction > 0.6 ? '#22c55e' : hpFraction > 0.3 ? '#eab308' : '#ef4444'
  const barWidth = 26
  const hasBuff = unit.effects.some((active) => ['haste', 'bless', 'stoneSkin'].includes(active.effect))
  const hasDebuff = unit.effects.some((active) => ['slow', 'curse'].includes(active.effect))

  let className = `unit unit--${unit.owner}`
  if (hit) className += ' unit--hit'
  if (dying) className += ' unit--dying'
  if (spotlight) className += ' unit--spotlight'
  if (unit.petrified) className += ' unit--petrified'

  return (
    <g className={className} transform={`translate(${point.x} ${point.y})`}>
      {active && <ellipse className="unit__active-ring" cx={0} cy={12} rx={20} ry={7} />}
      {targeted && <ellipse className="unit__target-ring" cx={0} cy={12} rx={20} ry={7} />}
      {spellTarget && <ellipse className="unit__spell-ring" cx={0} cy={12} rx={20} ry={7} />}
      {glow && <circle cx={0} cy={-8} r={24} style={{ fill: glow }} className="unit__glow" />}
      <ellipse cx={0} cy={13} rx={15} ry={4} fill="rgba(0,0,0,0.4)" />
      <g className="unit__sprite" transform="translate(0 14)">
        <SpriteImage spriteId={unit.type} owner={unit.owner} size={UNIT_SPRITE_SIZE} mirrored={unit.owner === 'blue'} />
      </g>
      {unit.defending && (
        <text className="unit__badge" x={unit.owner === 'red' ? -16 : 16} y={-22} textAnchor="middle" dominantBaseline="central">
          🛡️
        </text>
      )}
      <g transform={`translate(${unit.owner === 'red' ? 6 : -30} 8)`}>
        <rect
          className={`unit__count-box${hasBuff ? ' unit__count-box--buffed' : ''}${hasDebuff ? ' unit__count-box--debuffed' : ''}`}
          width={24}
          height={11}
        />
        <text className="unit__count" x={12} y={6} textAnchor="middle" dominantBaseline="central">
          {count}
        </text>
      </g>
      <rect className="unit__hp-background" x={-barWidth / 2 - 1} y={20} width={barWidth + 2} height={4} />
      <rect x={-barWidth / 2} y={21} width={barWidth * hpFraction} height={2} fill={hpColor} />
    </g>
  )
})
