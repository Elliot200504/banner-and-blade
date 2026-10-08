import { useRef, type MouseEvent } from 'react'
import { allHexes, hexKey, inBounds, sameHex, UNIT_STATS, type Hex, type Unit } from '../game'
import { BOARD_HEIGHT, BOARD_WIDTH, HEX_SIZE, hexCorners, hexToPixel, pixelToHex, type Point } from './layout'
import type { FloatingText, Projectile } from './useAnimator'

export const UNIT_ICONS: Record<Unit['type'], string> = { swordsman: '🗡️', archer: '🏹' }

/** A unit as it should be drawn right now (animation overrides already applied). */
export interface DisplayUnit {
  unit: Unit
  position: Hex
  hp: number
  lungeOffset: Point
  hit: boolean
  dying: boolean
}

interface BoardProps {
  units: DisplayUnit[]
  obstacles: Hex[]
  activeUnitId: string | null
  reachable: Set<string>
  pathPreview: Hex[]
  attackOrigin: Hex | null
  targetUnitId: string | null
  hoveredHex: Hex | null
  selectedHex: Hex | null
  projectile: Projectile | null
  floatingTexts: FloatingText[]
  cursor: string
  onPointerMove: (hex: Hex | null, point: Point | null) => void
  onBoardClick: (hex: Hex, point: Point) => void
}

const HEXES = allHexes()

export function Board(props: BoardProps) {
  const svgRef = useRef<SVGSVGElement>(null)

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

  const handleMouseMove = (event: MouseEvent) => {
    const point = toBoardPoint(event)
    const hex = point && pixelToHex(point)
    if (point && hex && inBounds(hex)) props.onPointerMove(hex, point)
    else props.onPointerMove(null, null)
  }

  const handleClick = (event: MouseEvent) => {
    const point = toBoardPoint(event)
    const hex = point && pixelToHex(point)
    if (point && hex && inBounds(hex)) props.onBoardClick(hex, point)
  }

  const pathKeys = new Set(props.pathPreview.map(hexKey))
  const sortedUnits = [...props.units].sort((first, second) => first.position.r - second.position.r)

  return (
    <svg
      ref={svgRef}
      className="board"
      viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
      style={{ cursor: props.cursor }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => props.onPointerMove(null, null)}
      onClick={handleClick}
    >
      <defs>
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--board-top)' }} />
          <stop offset="1" style={{ stopColor: 'var(--board-bottom)' }} />
        </linearGradient>
      </defs>
      <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="url(#grass)" />

      {HEXES.map((hex) => {
        const key = hexKey(hex)
        const center = hexToPixel(hex)
        let className = 'hex'
        if (props.reachable.has(key)) className += ' hex--reachable'
        if (pathKeys.has(key)) className += ' hex--path'
        if (props.attackOrigin && sameHex(props.attackOrigin, hex)) className += ' hex--origin'
        if (props.selectedHex && sameHex(props.selectedHex, hex)) className += ' hex--selected'
        if (props.hoveredHex && sameHex(props.hoveredHex, hex)) className += ' hex--hovered'
        return <polygon key={key} className={className} points={hexCorners(center, HEX_SIZE - 1)} />
      })}

      {props.obstacles.map((obstacle) => (
        <Rock key={hexKey(obstacle)} center={hexToPixel(obstacle)} />
      ))}

      {sortedUnits.map((displayUnit) => (
        <UnitToken
          key={displayUnit.unit.id}
          displayUnit={displayUnit}
          active={displayUnit.unit.id === props.activeUnitId}
          targeted={displayUnit.unit.id === props.targetUnitId}
        />
      ))}

      {props.projectile && (
        <g transform={`translate(${props.projectile.position.x} ${props.projectile.position.y}) rotate(${props.projectile.angle})`}>
          <line className="projectile__shaft" x1={-14} y1={0} x2={8} y2={0} />
          <polygon className="projectile__head" points="8,-5 16,0 8,5" />
        </g>
      )}

      {props.floatingTexts.map((floating) => (
        <g key={floating.id} transform={`translate(${floating.position.x} ${floating.position.y - 26})`}>
          <text className={`floating-text floating-text--${floating.tone}`} textAnchor="middle">
            {floating.text}
          </text>
        </g>
      ))}
    </svg>
  )
}

function Rock({ center }: { center: Point }) {
  return (
    <g transform={`translate(${center.x} ${center.y})`} className="rock">
      <ellipse cx={2} cy={14} rx={24} ry={7} fill="rgba(0,0,0,0.35)" />
      <polygon className="rock__body" points="-22,12 -18,-6 -6,-16 10,-14 21,-2 22,12" />
      <polygon className="rock__highlight" points="-12,-6 -4,-12 8,-10 4,0 -8,2" />
    </g>
  )
}

function UnitToken({ displayUnit, active, targeted }: { displayUnit: DisplayUnit; active: boolean; targeted: boolean }) {
  const { unit, hp, lungeOffset, hit, dying } = displayUnit
  const center = hexToPixel(displayUnit.position)
  const maxHp = UNIT_STATS[unit.type].maxHp
  const hpFraction = hp / maxHp
  const hpColor = hpFraction > 0.6 ? '#22c55e' : hpFraction > 0.3 ? '#eab308' : '#ef4444'
  const barWidth = 40

  let className = `unit unit--${unit.owner}`
  if (hit) className += ' unit--hit'
  if (dying) className += ' unit--dying'

  return (
    <g className={className} style={{ transform: `translate(${center.x + lungeOffset.x}px, ${center.y + lungeOffset.y}px)` }}>
      {active && <circle className="unit__active-ring" r={27} />}
      {targeted && <circle className="unit__target-ring" r={27} />}
      <ellipse cx={0} cy={18} rx={20} ry={6} fill="rgba(0,0,0,0.4)" />
      <circle className="unit__body" r={21} />
      <text className="unit__icon" y={1} textAnchor="middle" dominantBaseline="central">
        {UNIT_ICONS[unit.type]}
      </text>
      {unit.defending && (
        <text className="unit__badge" x={17} y={-15} textAnchor="middle" dominantBaseline="central">
          🛡️
        </text>
      )}
      <rect className="unit__hp-background" x={-barWidth / 2 - 1} y={22} width={barWidth + 2} height={7} />
      <rect x={-barWidth / 2} y={23} width={barWidth * hpFraction} height={5} fill={hpColor} />
    </g>
  )
}
