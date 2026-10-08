import { useEffect, useMemo, useState } from 'react'
import {
  activeUnit,
  applyMove,
  attackOrigins,
  canAttack,
  createInitialState,
  damageFor,
  hexKey,
  isEnemyAdjacent,
  reachableHexes,
  sameHex,
  unitAt,
  UNIT_STATS,
  type GameState,
  type Hex,
  type Move,
  type Unit,
} from '../game'
import { Board, type DisplayUnit } from './Board'
import { distanceBetween, hexToPixel, type Point } from './layout'
import { BattleLog, TurnBanner, UnitCard } from './SidePanel'
import { TurnQueue } from './TurnQueue'
import { useAnimator } from './useAnimator'
import { VictoryOverlay } from './VictoryOverlay'

/** What clicking the hex under the pointer would do. */
type Intent =
  | { kind: 'move'; to: Hex; path: Hex[] }
  | { kind: 'melee'; target: Unit; from: Hex; path: Hex[] }
  | { kind: 'shoot'; target: Unit }

interface BattleProps {
  onMainMenu: () => void
}

export function Battle({ onMainMenu }: BattleProps) {
  const [state, setState] = useState<GameState>(createInitialState)
  const [hoveredHex, setHoveredHex] = useState<Hex | null>(null)
  const [pointer, setPointer] = useState<Point | null>(null)
  const [selectedHex, setSelectedHex] = useState<Hex | null>(null)
  const animator = useAnimator()

  const actor = activeUnit(state)
  const canAct = !animator.playing && !state.winner && actor !== undefined

  const reachable = useMemo(
    () => (actor ? reachableHexes(state, actor) : new Map<string, Hex[]>()),
    [state, actor],
  )

  const intentAt = (hex: Hex, point: Point): Intent | null => {
    if (!actor) return null
    const occupant = unitAt(state.units, hex)
    if (occupant) {
      if (!canAttack(state, actor, occupant)) return null
      if (UNIT_STATS[actor.type].ranged) return { kind: 'shoot', target: occupant }
      // Strike from the free side of the target closest to the pointer.
      const origins = attackOrigins(state, actor, occupant)
      const from = origins.reduce((best, origin) =>
        distanceBetween(hexToPixel(origin), point) < distanceBetween(hexToPixel(best), point) ? origin : best,
      )
      const path = sameHex(from, actor.position) ? [] : (reachable.get(hexKey(from)) ?? [])
      return { kind: 'melee', target: occupant, from, path }
    }
    const path = reachable.get(hexKey(hex))
    return path ? { kind: 'move', to: hex, path } : null
  }

  const intent = canAct && hoveredHex && pointer ? intentAt(hoveredHex, pointer) : null

  const perform = async (move: Move) => {
    if (!canAct) return
    const next = applyMove(state, move)
    if (next === state) return
    setSelectedHex(null)
    await animator.play(next.events, state.units)
    setState(next)
    animator.finish()
  }

  const handleBoardClick = (hex: Hex, point: Point) => {
    const clickedIntent = canAct ? intentAt(hex, point) : null
    if (!clickedIntent) {
      setSelectedHex(selectedHex && sameHex(selectedHex, hex) ? null : hex)
      return
    }
    if (clickedIntent.kind === 'move') perform({ type: 'move', to: clickedIntent.to })
    else if (clickedIntent.kind === 'shoot') perform({ type: 'attack', targetId: clickedIntent.target.id })
    else perform({ type: 'attack', targetId: clickedIntent.target.id, from: clickedIntent.from })
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'd') perform({ type: 'defend' })
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  const restart = () => {
    setState(createInitialState())
    setSelectedHex(null)
  }

  const displayUnits: DisplayUnit[] = state.units.map((unit) => ({
    unit,
    position: animator.view.positions[unit.id] ?? unit.position,
    hp: animator.view.hp[unit.id] ?? unit.hp,
    lungeOffset: animator.view.lungeOffsets[unit.id] ?? { x: 0, y: 0 },
    hit: animator.view.hit[unit.id] ?? false,
    dying: animator.view.dying[unit.id] ?? false,
  }))

  const hoveredUnit = hoveredHex ? unitAt(state.units, hoveredHex) : undefined
  const selectedUnit = selectedHex ? unitAt(state.units, selectedHex) : undefined
  const inspectedUnit = hoveredUnit ?? selectedUnit ?? actor

  return (
    <div className="battle">
      <div className="battle__main">
        <TurnBanner state={state} actor={actor} />
        <div className="board-frame">
          <Board
            units={displayUnits}
            obstacles={state.obstacles}
            activeUnitId={animator.playing ? null : (actor?.id ?? null)}
            reachable={canAct ? new Set(reachable.keys()) : new Set()}
            pathPreview={intent && intent.kind !== 'shoot' ? intent.path : []}
            attackOrigin={intent?.kind === 'melee' ? intent.from : null}
            targetUnitId={intent && intent.kind !== 'move' ? intent.target.id : null}
            hoveredHex={hoveredHex}
            selectedHex={selectedHex}
            projectile={animator.view.projectile}
            floatingTexts={animator.floatingTexts}
            cursor={intent ? (intent.kind === 'shoot' ? 'crosshair' : 'pointer') : 'default'}
            onPointerMove={(hex, point) => {
              setHoveredHex(hex)
              setPointer(point)
            }}
            onBoardClick={handleBoardClick}
          />
        </div>
        <div className="status-bar">{statusText(state, actor, intent, hoveredUnit, canAct)}</div>
        <div className="battle__actions">
          <button className="button" disabled={!canAct} onClick={() => perform({ type: 'defend' })}>
            🛡️ Defend (D)
          </button>
        </div>
        <TurnQueue state={state} />
      </div>

      <aside className="battle__side">
        {inspectedUnit && <UnitCard unit={inspectedUnit} />}
        <BattleLog log={state.log} />
        <button className="button button--secondary" onClick={onMainMenu}>
          Main menu
        </button>
      </aside>

      {state.winner && !animator.playing && (
        <VictoryOverlay winner={state.winner} round={state.round} onPlayAgain={restart} onMainMenu={onMainMenu} />
      )}
    </div>
  )
}

function statusText(
  state: GameState,
  actor: Unit | undefined,
  intent: Intent | null,
  hoveredUnit: Unit | undefined,
  canAct: boolean,
): string {
  if (state.winner || !actor) return ''
  if (!canAct) return '…'
  if (intent?.kind === 'move') return `Move ${actor.label} here`
  if (intent) {
    const damage = damageFor(state.units, actor, intent.target)
    const kills = damage >= intent.target.hp ? ' – kills!' : ''
    if (intent.kind === 'shoot') {
      const blocked = isEnemyAdjacent(state.units, actor) ? ' (half: enemy adjacent)' : ''
      return `Shoot ${intent.target.label} for ${damage}${blocked}${kills}`
    }
    return `Attack ${intent.target.label} for ${damage}${kills}`
  }
  if (hoveredUnit) {
    return `${hoveredUnit.label} – ${hoveredUnit.hp}/${UNIT_STATS[hoveredUnit.type].maxHp} HP`
  }
  return `${actor.label}: move, attack, or defend`
}
