import { useCallback, useEffect, useRef, useState } from 'react'
import type { BattleEvent, Hex, Unit } from '../game'
import { distanceBetween, hexToPixel, type Point } from './layout'

const STEP_MS = 150
const LUNGE_MS = 130
const HIT_MS = 320
const DEATH_MS = 450
const DEFEND_MS = 400
const FLOAT_MS = 1000

export interface FloatingText {
  id: number
  position: Point
  text: string
  tone: 'damage' | 'info'
}

export interface Projectile {
  position: Point
  angle: number
}

/** Temporary changes drawn on top of the last committed state while a move plays out. */
export interface AnimationView {
  positions: Record<string, Hex>
  hp: Record<string, number>
  lungeOffsets: Record<string, Point>
  hit: Record<string, boolean>
  dying: Record<string, boolean>
  projectile: Projectile | null
}

const EMPTY_VIEW: AnimationView = { positions: {}, hp: {}, lungeOffsets: {}, hit: {}, dying: {}, projectile: null }

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function tween(milliseconds: number, onFrame: (progress: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / milliseconds)
      onFrame(progress)
      if (progress < 1) requestAnimationFrame(tick)
      else resolve()
    }
    requestAnimationFrame(tick)
  })
}

export function useAnimator() {
  const [view, setView] = useState<AnimationView>(EMPTY_VIEW)
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([])
  const [playing, setPlaying] = useState(false)
  const mounted = useRef(true)
  const nextFloatId = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const updateView = useCallback((change: (current: AnimationView) => AnimationView) => {
    if (mounted.current) setView(change)
  }, [])

  const addFloatingText = useCallback((hex: Hex, text: string, tone: FloatingText['tone']) => {
    const id = nextFloatId.current++
    setFloatingTexts((current) => [...current, { id, position: hexToPixel(hex), text, tone }])
    setTimeout(() => {
      if (mounted.current) setFloatingTexts((current) => current.filter((floating) => floating.id !== id))
    }, FLOAT_MS)
  }, [])

  /** Plays the events of a move, starting from the units as they were before it. */
  const play = useCallback(
    async (events: BattleEvent[], unitsBefore: Unit[]) => {
      setPlaying(true)
      const positions: Record<string, Hex> = Object.fromEntries(unitsBefore.map((unit) => [unit.id, unit.position]))

      for (const event of events) {
        if (!mounted.current) return
        switch (event.kind) {
          case 'move':
            for (const step of event.path.slice(1)) {
              positions[event.unitId] = step
              updateView((current) => ({ ...current, positions: { ...current.positions, [event.unitId]: step } }))
              await sleep(STEP_MS)
            }
            break

          case 'attack': {
            const from = hexToPixel(positions[event.attackerId])
            const to = hexToPixel(positions[event.targetId])
            if (event.ranged) {
              const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
              await tween(Math.max(220, distanceBetween(from, to) * 0.9), (progress) =>
                updateView((current) => ({
                  ...current,
                  projectile: {
                    position: { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress },
                    angle,
                  },
                })),
              )
              updateView((current) => ({ ...current, projectile: null }))
            } else {
              const lunge = { x: (to.x - from.x) * 0.35, y: (to.y - from.y) * 0.35 }
              updateView((current) => ({ ...current, lungeOffsets: { ...current.lungeOffsets, [event.attackerId]: lunge } }))
              await sleep(LUNGE_MS)
              updateView((current) => ({
                ...current,
                lungeOffsets: { ...current.lungeOffsets, [event.attackerId]: { x: 0, y: 0 } },
              }))
            }
            updateView((current) => ({
              ...current,
              hp: { ...current.hp, [event.targetId]: event.targetHp },
              hit: { ...current.hit, [event.targetId]: true },
            }))
            addFloatingText(positions[event.targetId], `-${event.damage}`, 'damage')
            await sleep(HIT_MS)
            updateView((current) => ({ ...current, hit: { ...current.hit, [event.targetId]: false } }))
            break
          }

          case 'death':
            updateView((current) => ({ ...current, dying: { ...current.dying, [event.unitId]: true } }))
            await sleep(DEATH_MS)
            break

          case 'defend':
            addFloatingText(positions[event.unitId], 'Defend', 'info')
            await sleep(DEFEND_MS)
            break
        }
      }
    },
    [updateView, addFloatingText],
  )

  const finish = useCallback(() => {
    setView(EMPTY_VIEW)
    setPlaying(false)
  }, [])

  return { view, floatingTexts, playing, play, finish }
}
