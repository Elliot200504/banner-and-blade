import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  activeUnit,
  afterDamage,
  allHexes,
  applyMove,
  attackMode,
  attackOrigins,
  breathVictim,
  castProblem,
  chooseMove,
  createBattle,
  CREATURES,
  damageRange,
  hasAbility,
  hexDistance,
  hexKey,
  isEnemyAdjacent,
  pathLength,
  PLAYER_NAMES,
  reachableHexes,
  sameHex,
  shotProblem,
  spellDamage,
  SPELLS,
  unitAt,
  type Faction,
  type GameState,
  type Hex,
  type Move,
  type Player,
  type SpellId,
  type Unit,
} from '../game'
import { Board, type BoardHighlights, type DisplayUnit } from './Board'
import { distanceBetween, hexToPixel, type Point } from './layout'
import { Modal } from './Modal'
import { ResultOverlay } from './ResultOverlay'
import { BattleLog, HeroPanel, UnitCard } from './SidePanel'
import { Spellbook } from './Spellbook'
import type { Controller } from './StartScreen'
import { TurnQueue } from './TurnQueue'
import { useAnimator } from './useAnimator'
import { SPEED_FACTORS, useBattleSpeed, type BattleSpeed } from './useBattleSpeed'
import type { Theme } from './useTheme'

/** A short pause before each computer move, so you can follow what it does. */
const COMPUTER_DELAY_MS = 450

/** What clicking the hex under the pointer would do. */
type Intent =
  | { kind: 'move'; to: Hex; path: Hex[] }
  | { kind: 'melee'; target: Unit; from: Hex; path: Hex[] }
  | { kind: 'shoot'; target: Unit }
  | { kind: 'cast'; spell: SpellId; target: Unit }

interface BattleProps {
  factions: Record<Player, Faction>
  controllers: Record<Player, Controller>
  seed: number
  theme: Theme
  onPlayAgain: () => void
  onMainMenu: () => void
}

export function Battle({ factions, controllers, seed, theme, onPlayAgain, onMainMenu }: BattleProps) {
  const [state, setState] = useState<GameState>(() => createBattle(factions, seed))
  const [hoveredHex, setHoveredHex] = useState<Hex | null>(null)
  const [pointer, setPointer] = useState<Point | null>(null)
  const [selectedHex, setSelectedHex] = useState<Hex | null>(null)
  const [pendingSpell, setPendingSpell] = useState<SpellId | null>(null)
  const [spellbookOpen, setSpellbookOpen] = useState(false)
  const [retreatOpen, setRetreatOpen] = useState(false)
  const [detailsUnitId, setDetailsUnitId] = useState<string | null>(null)
  const [spotlightUnitId, setSpotlightUnitId] = useState<string | null>(null)
  const [speed, setSpeed] = useBattleSpeed()
  const animator = useAnimator()

  const actor = activeUnit(state)
  const modalOpen = spellbookOpen || retreatOpen || detailsUnitId !== null
  /** Nothing is animating and someone has a turn to take. */
  const ready = !animator.playing && !state.winner && actor !== undefined
  const computerTurn = actor !== undefined && controllers[actor.owner] === 'computer'
  /** Whether the person at the keyboard may act. */
  const canAct = ready && !computerTurn
  const hero = actor ? state.heroes[actor.owner] : undefined

  const reachable = useMemo(
    () => (actor ? reachableHexes(state, actor) : new Map<string, Hex[]>()),
    [state, actor],
  )

  const inRange = useMemo(() => {
    const hexes = new Set<string>()
    if (!actor || pendingSpell) return hexes
    const stats = CREATURES[actor.type]
    if (stats.range === 0 || actor.shots === 0 || isEnemyAdjacent(state.units, actor)) return hexes
    for (const hex of allHexes()) {
      if (hexDistance(actor.position, hex) <= stats.range) hexes.add(hexKey(hex))
    }
    return hexes
  }, [state, actor, pendingSpell])

  const intentAt = (hex: Hex, point: Point): Intent | null => {
    if (!actor) return null
    const occupant = unitAt(state.units, hex)
    if (pendingSpell) {
      return occupant && !castProblem(state, pendingSpell, occupant.id)
        ? { kind: 'cast', spell: pendingSpell, target: occupant }
        : null
    }
    if (occupant) {
      const mode = attackMode(state, actor, occupant)
      if (mode === 'shoot') return { kind: 'shoot', target: occupant }
      if (mode !== 'melee') return null
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

  const intent = canAct && !modalOpen && hoveredHex && pointer ? intentAt(hoveredHex, pointer) : null

  const perform = useCallback(
    async (move: Move) => {
      if (!ready) return
      const next = applyMove(state, move)
      if (next === state) return
      setSelectedHex(null)
      setPendingSpell(null)
      await animator.play(next.events, state.units, SPEED_FACTORS[speed])
      setState(next)
      animator.finish()
    },
    [ready, state, animator, speed],
  )

  // The computer moves on its own turns. The latest perform is kept in a ref so that
  // re-renders (like hovering the board) don't restart the pause before its move.
  const performRef = useRef(perform)
  performRef.current = perform
  useEffect(() => {
    if (!ready || !computerTurn || modalOpen) return
    const timer = setTimeout(() => performRef.current(chooseMove(state)), COMPUTER_DELAY_MS * SPEED_FACTORS[speed])
    return () => clearTimeout(timer)
  }, [ready, computerTurn, modalOpen, state, speed])

  const performIntent = (chosen: Intent) => {
    if (chosen.kind === 'move') perform({ type: 'move', to: chosen.to })
    else if (chosen.kind === 'shoot') perform({ type: 'attack', targetId: chosen.target.id })
    else if (chosen.kind === 'melee') perform({ type: 'attack', targetId: chosen.target.id, from: chosen.from })
    else perform({ type: 'cast', spell: chosen.spell, targetId: chosen.target.id })
  }

  const handleBoardClick = (hex: Hex, point: Point) => {
    const clickedIntent = canAct ? intentAt(hex, point) : null
    if (clickedIntent) performIntent(clickedIntent)
    else setSelectedHex(selectedHex && sameHex(selectedHex, hex) ? null : hex)
  }

  const handleBoardRightClick = (hex: Hex) => {
    const unit = unitAt(state.units, hex)
    if (unit) setDetailsUnitId(unit.id)
  }

  const openSpellbook = () => {
    if (canAct) setSpellbookOpen(true)
  }

  useEffect(() => {
    if (modalOpen) return
    const handleKey = (event: KeyboardEvent) => {
      if (!canAct) return
      const key = event.key.toLowerCase()
      if (key === 'd') perform({ type: 'defend' })
      else if (key === 'w') perform({ type: 'wait' })
      else if (key === 'c') openSpellbook()
      else if (key === 'escape') setPendingSpell(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  const displayUnits: DisplayUnit[] = state.units.map((unit) => ({
    unit,
    point: animator.view.positions[unit.id] ?? hexToPixel(unit.position),
    count: animator.view.stacks[unit.id]?.count ?? unit.count,
    topHp: animator.view.stacks[unit.id]?.topHp ?? unit.topHp,
    hit: animator.view.hit[unit.id] ?? false,
    dying: animator.view.dying[unit.id] ?? false,
    glow: animator.view.glow[unit.id] ?? '',
  }))

  const spellTargetIds = new Set(
    pendingSpell ? state.units.filter((unit) => !castProblem(state, pendingSpell, unit.id)).map((unit) => unit.id) : [],
  )
  const targetUnitIds = new Set<string>()
  if (intent && intent.kind !== 'move') {
    targetUnitIds.add(intent.target.id)
    if (intent.kind === 'shoot' && actor && hasAbility(actor.type, 'deathCloud')) {
      for (const unit of state.units) {
        if (hexDistance(unit.position, intent.target.position) === 1 && !hasAbility(unit.type, 'undead')) {
          targetUnitIds.add(unit.id)
        }
      }
    }
    if (intent.kind === 'melee' && actor && hasAbility(actor.type, 'breath')) {
      const burned = breathVictim(state.units, intent.from, intent.target)
      if (burned) targetUnitIds.add(burned.id)
    }
  }

  const highlights: BoardHighlights = {
    activeUnitId: animator.playing ? null : (actor?.id ?? null),
    reachable: canAct && !pendingSpell ? new Set(reachable.keys()) : new Set(),
    inRange: canAct ? inRange : new Set(),
    pathPreview: intent && (intent.kind === 'move' || intent.kind === 'melee') ? intent.path : [],
    attackOrigin: intent?.kind === 'melee' ? intent.from : null,
    targetUnitIds,
    spellTargetIds,
    spotlightUnitId,
    hoveredHex,
    selectedHex,
  }

  const hoveredUnit = hoveredHex ? unitAt(state.units, hoveredHex) : undefined
  const spotlightUnit = state.units.find((unit) => unit.id === spotlightUnitId)
  const selectedUnit = selectedHex ? unitAt(state.units, selectedHex) : undefined
  const inspectedUnit = hoveredUnit ?? spotlightUnit ?? selectedUnit ?? actor
  const detailsUnit = state.units.find((unit) => unit.id === detailsUnitId)

  let cursor = 'default'
  if (intent?.kind === 'shoot' || intent?.kind === 'cast') cursor = 'crosshair'
  else if (intent) cursor = 'pointer'
  else if (hoveredUnit && canAct && hoveredUnit.owner !== actor?.owner) cursor = 'not-allowed'

  return (
    <div className="battle">
      <div className="battle__heroes">
        <HeroPanel state={state} player="red" active={actor?.owner === 'red'} />
        <TurnBanner state={state} actor={actor} computer={computerTurn} />
        <HeroPanel state={state} player="blue" active={actor?.owner === 'blue'} />
      </div>

      <div className="battle__body">
        <div className="battle__main">
          <div className="board-frame">
            <Board
              units={displayUnits}
              obstacles={state.obstacles}
              highlights={highlights}
              projectile={animator.view.projectile}
              lightning={animator.view.lightning}
              floatingTexts={animator.floatingTexts}
              cursor={cursor}
              theme={theme}
              onPointerMove={(hex, point) => {
                setHoveredHex(hex)
                setPointer(point)
              }}
              onBoardClick={handleBoardClick}
              onBoardRightClick={handleBoardRightClick}
            />
          </div>

          <div className={`status-bar${pendingSpell ? ' status-bar--spell' : ''}`}>
            {computerTurn && actor && !state.winner
              ? `${PLAYER_NAMES[actor.owner]} (computer) is thinking…`
              : statusText(state, actor, intent, hoveredUnit, canAct, pendingSpell)}
          </div>

          <div className="action-bar">
            <button className="button button--secondary" disabled={!canAct} onClick={() => setRetreatOpen(true)}>
              🏳️ Retreat
            </button>
            <button
              className="button"
              disabled={!canAct || !hero || hero.hasCastThisRound}
              onClick={openSpellbook}
              title="Spellbook (C)"
            >
              📖 Cast (C)
            </button>
            <button
              className="button"
              disabled={!canAct || !actor || actor.waited}
              onClick={() => perform({ type: 'wait' })}
              title="Act later this round (W)"
            >
              ⏳ Wait (W)
            </button>
            <button className="button" disabled={!canAct} onClick={() => perform({ type: 'defend' })} title="Defend (D)">
              🛡️ Defend (D)
            </button>
            <label className="speed-select">
              Speed
              <select value={speed} onChange={(event) => setSpeed(event.target.value as BattleSpeed)}>
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </label>
          </div>

          <TurnQueue state={state} onHover={setSpotlightUnitId} />
        </div>

        <aside className="battle__side">
          {inspectedUnit && <UnitCard unit={inspectedUnit} state={state} />}
          <BattleLog log={state.log} />
          <p className="battle__hint">Right-click a stack for details.</p>
          <button className="button button--secondary" onClick={onMainMenu}>
            Main menu
          </button>
        </aside>
      </div>

      {spellbookOpen && hero && (
        <Spellbook
          hero={hero}
          onClose={() => setSpellbookOpen(false)}
          onChoose={(spell) => {
            setSpellbookOpen(false)
            setPendingSpell(spell)
          }}
        />
      )}

      {retreatOpen && actor && (
        <Modal title="Retreat?" onClose={() => setRetreatOpen(false)}>
          <p className="modal__text">
            {PLAYER_NAMES[actor.owner]} will flee the field and {PLAYER_NAMES[actor.owner === 'red' ? 'blue' : 'red']} wins
            the battle.
          </p>
          <div className="modal__buttons">
            <button
              className="button"
              onClick={() => {
                setRetreatOpen(false)
                perform({ type: 'retreat' })
              }}
            >
              Retreat
            </button>
            <button className="button button--secondary" onClick={() => setRetreatOpen(false)} autoFocus>
              Keep fighting
            </button>
          </div>
        </Modal>
      )}

      {detailsUnit && (
        <Modal title={detailsUnit.label} onClose={() => setDetailsUnitId(null)} className="details">
          <UnitCard unit={detailsUnit} state={state} />
        </Modal>
      )}

      {state.winner && !animator.playing && (
        <ResultOverlay state={state} onPlayAgain={onPlayAgain} onMainMenu={onMainMenu} />
      )}
    </div>
  )
}

function TurnBanner({ state, actor, computer }: { state: GameState; actor: Unit | undefined; computer: boolean }) {
  return (
    <div className={`turn-banner${actor && !state.winner ? ` turn-banner--${actor.owner}` : ''}`}>
      <span className="turn-banner__round">Round {state.round}</span>
      {actor && !state.winner && (
        <span>
          {PLAYER_NAMES[actor.owner]}'s turn{computer ? ' (CPU)' : ''}
          <br />
          {actor.count} {CREATURES[actor.type].plural}
        </span>
      )}
    </div>
  )
}

function killsText(target: Unit, minimum: number, maximum: number): string {
  const fewest = afterDamage(target, minimum).kills
  const most = afterDamage(target, maximum).kills
  return fewest === most ? `${most}` : `${fewest}–${most}`
}

function statusText(
  state: GameState,
  actor: Unit | undefined,
  intent: Intent | null,
  hoveredUnit: Unit | undefined,
  canAct: boolean,
  pendingSpell: SpellId | null,
): string {
  if (state.winner || !actor) return ''
  if (!canAct) return '…'
  const attackerHero = state.heroes[actor.owner]

  if (pendingSpell) {
    if (intent?.kind === 'cast') {
      const damage = spellDamage(intent.spell, attackerHero.spellPower)
      const damageNote = damage > 0 ? ` – ${damage} damage, kills ${killsText(intent.target, damage, damage)}` : ''
      return `Cast ${SPELLS[intent.spell].name} on ${intent.target.label}${damageNote}`
    }
    return `Choose a target for ${SPELLS[pendingSpell].name}. Esc to cancel.`
  }

  if (intent?.kind === 'move') {
    const flying = hasAbility(actor.type, 'flying')
    return `${flying ? 'Fly' : 'Move'} ${actor.label} here (${pathLength(intent.path)} hexes)`
  }
  if (intent?.kind === 'shoot' || intent?.kind === 'melee') {
    const targetHero = state.heroes[intent.target.owner]
    const ranged = intent.kind === 'shoot'
    const hexesMoved = intent.kind === 'melee' ? pathLength(intent.path) : 0
    const range = damageRange(actor, attackerHero, intent.target, targetHero, { ranged, hexesMoved })
    const damage = range.minimum === range.maximum ? `${range.maximum}` : `${range.minimum}–${range.maximum}`
    const verb = ranged ? 'Shoot' : 'Attack'
    const shotsLeft = ranged ? ` · ${actor.shots} shots left` : ''
    const burned = !ranged && hasAbility(actor.type, 'breath') ? breathVictim(state.units, intent.from, intent.target) : undefined
    const breathNote = burned ? ` · fire also burns ${burned.label}` : ''
    const flyBack = !ranged && hasAbility(actor.type, 'hitAndRun') && intent.path.length > 0 ? ' · then flies back' : ''
    return `${verb} ${intent.target.label}: ${damage} damage, kills ${killsText(intent.target, range.minimum, range.maximum)}${shotsLeft}${breathNote}${flyBack}`
  }

  if (hoveredUnit && hoveredUnit.owner !== actor.owner) {
    const problem = shotProblem(state.units, actor, hoveredUnit)
    const distance = hexDistance(actor.position, hoveredUnit.position)
    if (problem === 'outOfRange') return `Out of range: ${distance} hexes away, range is ${CREATURES[actor.type].range}.`
    return `${hoveredUnit.label} are out of reach.`
  }
  if (hoveredUnit) return `${hoveredUnit.count} ${CREATURES[hoveredUnit.type].plural} – right-click for details`

  const blocked = CREATURES[actor.type].range > 0 && isEnemyAdjacent(state.units, actor) ? ' Blocked: cannot shoot!' : ''
  return `${actor.label} (${actor.count}): move, attack, wait or defend.${blocked}`
}
