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
} from '../../game'
import { Board, type BoardHighlights, type DisplayUnit } from './Board'
import { hexToPixel, standPoint } from './layout'
import { useAnimator } from './useAnimator'
import type { Theme } from '../hooks/useTheme'

/** How long each step shows what is about to be clicked, and how long the board rests after it. */
const AIM_MS = 1500
const REST_MS = 700
const LOOP_PAUSE_MS = 1600
/** The demo board never grows taller than this, so the rules stay in view. */
const MAX_HEIGHT = 250

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

function battleWith(units: Unit[]): GameState {
  return { ...createBattle({ red: 'castle', blue: 'necropolis' }, 7), units, obstacles: [], queue: units.map((unit) => unit.id) }
}

export interface Step {
  caption: string
  actorId: string
  move: Move
  /** The hex the pretend player points at before clicking. */
  aim: Hex
}

/** One scene the demo can play: where everyone starts, and what happens. */
export interface Scenario {
  start: () => GameState
  steps: Step[]
}

/** The demos, one per How to play topic, and a short tour of the basics. */
export type DemoId = 'tour' | 'move' | 'attack' | 'actions' | 'spellbook' | 'win'

const MOVE_STEP: Step = {
  caption: 'Click a shaded hex to move',
  actorId: CAVALIERS.id,
  move: { type: 'move', to: offsetToHex(6, 5) },
  aim: offsetToHex(6, 5),
}

const CHARGE_STEP: Step = {
  caption: 'Click an enemy to attack it',
  actorId: CAVALIERS.id,
  move: { type: 'attack', targetId: SKELETONS.id, from: offsetToHex(9, 5) },
  aim: SKELETONS.position,
}

const VOLLEY_STEP: Step = {
  caption: 'Shooters fire from afar',
  actorId: ARCHERS.id,
  move: { type: 'attack', targetId: WALKING_DEAD.id },
  aim: WALKING_DEAD.position,
}

const startingState = () => battleWith([CAVALIERS, ARCHERS, SKELETONS, WALKING_DEAD])

/** Just one small stack left, so the next blow wins the battle. */
const LAST_STAND = demoUnit('skeleton', 'blue', 7, 5, 2)

export const DEMOS: Record<DemoId, Scenario> = {
  tour: { start: startingState, steps: [MOVE_STEP, CHARGE_STEP, VOLLEY_STEP] },
  move: { start: startingState, steps: [MOVE_STEP] },
  attack: { start: startingState, steps: [CHARGE_STEP, VOLLEY_STEP] },
  actions: {
    start: startingState,
    steps: [
      { caption: 'W: wait and act later this round', actorId: ARCHERS.id, move: { type: 'wait' }, aim: ARCHERS.position },
      { caption: 'D: defend for extra defense', actorId: CAVALIERS.id, move: { type: 'defend' }, aim: CAVALIERS.position },
    ],
  },
  spellbook: {
    start: startingState,
    steps: [
      {
        caption: 'C opens the spellbook: Bless your Cavaliers',
        actorId: CAVALIERS.id,
        move: { type: 'cast', spell: 'bless', targetId: CAVALIERS.id },
        aim: CAVALIERS.position,
      },
      { ...CHARGE_STEP, caption: 'The spell does not end the turn: now charge for full damage' },
    ],
  },
  win: {
    start: () => battleWith([CAVALIERS, ARCHERS, LAST_STAND]),
    steps: [
      {
        caption: 'Destroy every enemy stack to win',
        actorId: CAVALIERS.id,
        move: { type: 'attack', targetId: LAST_STAND.id, from: offsetToHex(6, 5) },
        aim: LAST_STAND.position,
      },
    ],
  },
}

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
  } else if (step.move.type === 'cast' && step.move.targetId) {
    highlights.spellTargetIds = new Set([step.move.targetId])
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

/** A short battle that plays itself on a loop, showing one How to play topic (or a tour of the basics). */
export function BattleDemo({ demo }: { demo: DemoId }) {
  const scenario = DEMOS[demo]
  const [state, setState] = useState(scenario.start)
  const [highlights, setHighlights] = useState(IDLE)
  const [caption, setCaption] = useState(scenario.steps[0].caption)
  const animator = useAnimator({ silent: true })
  const { play, finish } = animator
  const theme = (document.documentElement.dataset.theme ?? 'default') as Theme

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      while (!cancelled) {
        let current = scenario.start()
        setState(current)
        finish()

        for (const step of scenario.steps) {
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
  }, [play, finish, scenario])

  const displayUnits: DisplayUnit[] = state.units.map((unit) => ({
    unit,
    point: animator.view.positions[unit.id] ?? standPoint(unit),
    count: animator.view.stacks[unit.id]?.count ?? unit.count,
    topHp: animator.view.stacks[unit.id]?.topHp ?? unit.topHp,
    hit: animator.view.hit[unit.id] ?? false,
    dying: animator.view.dying[unit.id] ?? false,
    glow: animator.view.glow[unit.id] ?? '',
    pose: animator.view.pose[unit.id] ?? null,
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
