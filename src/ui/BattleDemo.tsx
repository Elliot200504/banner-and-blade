import { useEffect, useState } from 'react'
import {
  applyMove,
  createBattle,
  CREATURES,
  hexKey,
  offsetToHex,
  PLAYER_NAMES,
  reachableHexes,
  type CreatureType,
  type GameState,
  type Hex,
  type Move,
  type Player,
  type Unit,
} from '../game'
import { Board, type BoardHighlights, type DisplayUnit } from './Board'
import { hexToPixel } from './layout'
import { useAnimator } from './useAnimator'
import type { Theme } from './useTheme'

/** How long each step shows what is about to be clicked, and how long the board rests after it. */
const AIM_MS = 1500
const REST_MS = 700
const LOOP_PAUSE_MS = 1600
/** The demo board never grows taller than this, so the rules stay in view. */
const MAX_HEIGHT = 300

function demoUnit(type: CreatureType, owner: Player, column: number, row: number, count: number): Unit {
  const stats = CREATURES[type]

  return {
    id: `demo-${owner}-${type}`,
    label: `${PLAYER_NAMES[owner]} ${stats.plural}`,
    type,
    owner,
    position: offsetToHex(column, row),
    count,
    startCount: count,
    topHp: stats.hp,
    shots: stats.shots,
    retaliationsLeft: 1,
    defending: false,
    waited: false,
    hadMoraleTurn: false,
    petrified: false,
    lostTurn: false,
    specialty: false,
    effects: [],
  }
}

const CAVALIERS = demoUnit('cavalier', 'red', 3, 5, 6)
const ARCHERS = demoUnit('archer', 'red', 3, 3, 12)
const SKELETONS = demoUnit('skeleton', 'blue', 10, 5, 20)
const WALKING_DEAD = demoUnit('walkingDead', 'blue', 8, 3, 10)

export function startingState(): GameState {
  const units = [CAVALIERS, ARCHERS, SKELETONS, WALKING_DEAD]

  return { ...createBattle({ red: 'castle', blue: 'necropolis' }, 7), units, obstacles: [], queue: units.map((unit) => unit.id) }
}

export interface Step {
  caption: string
  actorId: string
  move: Move
  /** The hex the pretend player points at before clicking. */
  aim: Hex
}

export const STEPS: Step[] = [
  { caption: 'Click a shaded hex to move', actorId: CAVALIERS.id, move: { type: 'move', to: offsetToHex(6, 5) }, aim: offsetToHex(6, 5) },
  {
    caption: 'Click an enemy to attack it',
    actorId: CAVALIERS.id,
    move: { type: 'attack', targetId: SKELETONS.id, from: offsetToHex(9, 5) },
    aim: SKELETONS.position,
  },
  { caption: 'Shooters fire from afar', actorId: ARCHERS.id, move: { type: 'attack', targetId: WALKING_DEAD.id }, aim: WALKING_DEAD.position },
]

/** The middle of the field, where the demo plays out. */
const topLeft = hexToPixel(offsetToHex(2, 2))
const bottomRight = hexToPixel(offsetToHex(11, 6))
const VIEW_WIDTH = bottomRight.x - topLeft.x + 60
const VIEW_HEIGHT = bottomRight.y - topLeft.y + 60
const VIEW_BOX = `${topLeft.x - 30} ${topLeft.y - 34} ${VIEW_WIDTH} ${VIEW_HEIGHT}`

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

/** Puts the step's stack at the front of the turn order, so the scripted move is its turn. */
export const withActor = (state: GameState, actorId: string): GameState => ({
  ...state,
  queue: [actorId, ...state.units.map((unit) => unit.id).filter((id) => id !== actorId)],
})

function aimHighlights(state: GameState, step: Step): BoardHighlights {
  const actor = state.units.find((unit) => unit.id === step.actorId)!
  const reachable = reachableHexes(state, actor)
  const highlights: BoardHighlights = {
    activeUnitId: actor.id,
    reachable: new Set(),
    inRange: new Set(),
    pathPreview: [],
    attackOrigin: null,
    targetUnitIds: new Set(),
    spellTargetIds: new Set(),
    spotlightUnitId: null,
    hoveredHex: step.aim,
    selectedHex: null,
  }

  if (step.move.type === 'move') {
    highlights.reachable = new Set(reachable.keys())
    highlights.pathPreview = reachable.get(hexKey(step.move.to)) ?? []
  } else if (step.move.type === 'attack') {
    highlights.targetUnitIds = new Set([step.move.targetId])

    if (step.move.from) {
      highlights.reachable = new Set(reachable.keys())
      highlights.pathPreview = reachable.get(hexKey(step.move.from)) ?? []
      highlights.attackOrigin = step.move.from
    }
  }

  return highlights
}

const IDLE: BoardHighlights = {
  activeUnitId: null,
  reachable: new Set(),
  inRange: new Set(),
  pathPreview: [],
  attackOrigin: null,
  targetUnitIds: new Set(),
  spellTargetIds: new Set(),
  spotlightUnitId: null,
  hoveredHex: null,
  selectedHex: null,
}

/** A short battle that plays itself on a loop, showing how to move, attack and shoot. */
export function BattleDemo() {
  const [state, setState] = useState(startingState)
  const [highlights, setHighlights] = useState(IDLE)
  const [caption, setCaption] = useState(STEPS[0].caption)
  const animator = useAnimator({ silent: true })
  const { play, finish } = animator
  const theme = (document.documentElement.dataset.theme ?? 'default') as Theme

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      while (!cancelled) {
        let current = startingState()
        setState(current)

        for (const step of STEPS) {
          current = withActor(current, step.actorId)
          setState(current)
          setCaption(step.caption)
          setHighlights(aimHighlights(current, step))
          await sleep(AIM_MS)

          if (cancelled) {
            return
          }

          const next = applyMove(current, step.move)
          setHighlights(IDLE)
          await play(next.events, current.units, 1)

          if (cancelled) {
            return
          }

          current = next
          setState(current)
          finish()
          await sleep(REST_MS)
        }

        await sleep(LOOP_PAUSE_MS)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [play, finish])

  const displayUnits: DisplayUnit[] = state.units.map((unit) => ({
    unit,
    point: animator.view.positions[unit.id] ?? hexToPixel(unit.position),
    count: animator.view.stacks[unit.id]?.count ?? unit.count,
    topHp: animator.view.stacks[unit.id]?.topHp ?? unit.topHp,
    hit: animator.view.hit[unit.id] ?? false,
    dying: animator.view.dying[unit.id] ?? false,
    glow: animator.view.glow[unit.id] ?? '',
  }))

  return (
    <figure className="battle-demo" aria-label="A short battle showing how to move, attack and shoot">
      <figcaption className="battle-demo__caption">{caption}</figcaption>
      <div className="battle-demo__board" style={{ aspectRatio: `${VIEW_WIDTH} / ${VIEW_HEIGHT}`, width: `min(100%, ${(MAX_HEIGHT * VIEW_WIDTH) / VIEW_HEIGHT}px)` }}>
        <Board
          units={displayUnits}
          obstacles={state.obstacles}
          factions={state.factions}
          highlights={highlights}
          projectile={animator.view.projectile}
          lightning={animator.view.lightning}
          floatingTexts={animator.floatingTexts}
          cursor="default"
          theme={theme}
          viewBox={VIEW_BOX}
          onPointerMove={() => {}}
          onBoardClick={() => {}}
          onBoardRightClick={() => {}}
        />
      </div>
    </figure>
  )
}
