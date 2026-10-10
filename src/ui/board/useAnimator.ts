import { useCallback, useEffect, useRef, useState } from 'react'
import { SPELLS, type BattleEvent, type CreatureType, type Hex, type Player, type SpellId, type Unit } from '../../game'
import { distanceBetween, HERO_POINTS, HERO_SIZE, hexToPixel, standPoint, type Point } from './layout'
import { playSound, type SoundId } from '../audio/sound'
import { flightOf, gaitOf } from './creatureMotion'

const STEP_MS = 140
const FLY_MS_PER_HEX = 80
/** Time between wing beats while flying, for ordinary and great wings. */
const FLAP_MS = { wings: 300, heavyWings: 420 }
const LUNGE_MS = 120
const WIND_UP_MS = 110
const HIT_MS = 300
const DEATH_MS = 600
/** How long a hero raises their hand before the spell flies, and how long a spell's effect plays on its target. */
const CAST_MS = 380
const SPELL_EFFECT_MS = 650
const NOTE_MS = 380
const FLOAT_MS = 1100

export type ProjectileKind = 'arrow' | 'holy' | 'death' | 'magic' | 'fire'

const PROJECTILE_FOR: Partial<Record<CreatureType, ProjectileKind>> = {
  ballista: 'arrow',
  archer: 'arrow',
  monk: 'holy',
  lich: 'death',
  beholder: 'magic',
  medusa: 'arrow',
  woodElf: 'arrow',
  orc: 'arrow',
  cyclops: 'magic',
  gog: 'fire',
  marksman: 'arrow',
  zealot: 'holy',
  grandElf: 'arrow',
  orcChieftain: 'arrow',
  cyclopsKing: 'magic',
  powerLich: 'death',
  evilEye: 'magic',
  medusaQueen: 'arrow',
  magog: 'fire',
  masterGremlin: 'arrow',
  mage: 'magic',
  archMage: 'magic',
  titan: 'magic',
  lizardman: 'arrow',
  lizardWarrior: 'arrow',
  stormElemental: 'magic',
  iceElemental: 'magic',
}

const PROJECTILE_SOUND: Record<ProjectileKind, SoundId> = {
  arrow: 'shoot',
  holy: 'magic',
  death: 'magic',
  magic: 'magic',
  fire: 'fire',
}

export interface FloatingText {
  id: number
  position: Point
  text: string
  tone: 'damage' | 'kills' | 'info' | 'good' | 'magic'
}

export interface Projectile {
  position: Point
  angle: number
  kind: ProjectileKind
}

/** Temporary changes drawn on top of the last committed state while a move plays out. */
/** A spell's effect playing out over a stack. `id` restarts the effect when the same spell lands twice in a row. */
export interface SpellEffect {
  id: number
  spell: SpellId
  point: Point
}

/** A stack's attack pose while it strikes or shoots. */
export type Pose = 'strike' | 'shoot'

export interface AnimationView {
  positions: Record<string, Point>
  pose: Record<string, Pose>
  stacks: Record<string, { count: number; topHp: number }>
  hit: Record<string, boolean>
  dying: Record<string, boolean>
  glow: Record<string, string>
  projectile: Projectile | null
  lightning: Point | null
  /** The hero raising their hand to cast. */
  casting: Player | null
  spellEffects: SpellEffect[]
}

const EMPTY_VIEW: AnimationView = {
  positions: {},
  pose: {},
  stacks: {},
  hit: {},
  dying: {},
  glow: {},
  projectile: null,
  lightning: null,
  casting: null,
  spellEffects: [],
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function tween(milliseconds: number, onFrame: (progress: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / milliseconds)
      onFrame(progress)

      if (progress < 1) {
        requestAnimationFrame(tick)
      } else {
        resolve()
      }
    }
    requestAnimationFrame(tick)
  })
}

const between = (from: Point, to: Point, progress: number): Point => ({
  x: from.x + (to.x - from.x) * progress,
  y: from.y + (to.y - from.y) * progress,
})

/** Where a hero's spell comes from: the caster's raised hands, up on horseback. */
const casterPoint = (caster: Player): Point => ({ x: HERO_POINTS[caster].x, y: HERO_POINTS[caster].y - HERO_SIZE * 0.85 })

/** With `silent`, moves play out without sound, as in the How to play demo. */
let nextEffectId = 0

export function useAnimator({ silent = false }: { silent?: boolean } = {}) {
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
    if (mounted.current) {
      setView(change)
    }
  }, [])

  const addFloatingText = useCallback((position: Point, text: string, tone: FloatingText['tone'], offsetY = 0) => {
    const id = nextFloatId.current++
    setFloatingTexts((current) => [...current, { id, position: { x: position.x, y: position.y + offsetY }, text, tone }])
    setTimeout(() => {
      if (mounted.current) {
        setFloatingTexts((current) => current.filter((floating) => floating.id !== id))
      }
    }, FLOAT_MS)
  }, [])

  /**
   * Plays the events of a move, starting from the units as they were before it.
   * `speed` scales every duration: below 1 is faster, above 1 is slower.
   */
  const play = useCallback(
    async (events: BattleEvent[], unitsBefore: Unit[], speed: number) => {
      setPlaying(true)
      const sound = (soundId: SoundId) => {
        if (!silent) {
          playSound(soundId)
        }
      }
      const duration = (milliseconds: number) => milliseconds * speed
      const positions: Record<string, Point> = Object.fromEntries(
        unitsBefore.map((unit) => [unit.id, standPoint(unit)]),
      )
      const typeOf = (unitId: string) => unitsBefore.find((unit) => unit.id === unitId)?.type
      /** Where a stack is drawn with its front on `hex`. */
      const pointFor = (unitId: string, hex: Hex) => {
        const unit = unitsBefore.find((candidate) => candidate.id === unitId)

        return unit ? standPoint(unit, hex) : hexToPixel(hex)
      }
      const setPosition = (unitId: string, point: Point) =>
        updateView((current) => ({ ...current, positions: { ...current.positions, [unitId]: point } }))
      const setProjectile = (projectile: Projectile | null) => updateView((current) => ({ ...current, projectile }))
      const setPose = (unitId: string, pose: Pose | null) =>
        updateView((current) => {
          const others = Object.fromEntries(Object.entries(current.pose).filter(([id]) => id !== unitId))

          return { ...current, pose: pose ? { ...others, [unitId]: pose } : others }
        })

      const showHit = async (targetId: string, count: number, topHp: number, damage: number, kills: number) => {
        updateView((current) => ({
          ...current,
          stacks: { ...current.stacks, [targetId]: { count, topHp } },
          hit: { ...current.hit, [targetId]: true },
        }))
        sound('hit')
        addFloatingText(positions[targetId], `-${damage}`, 'damage')

        if (kills > 0) {
          addFloatingText(positions[targetId], `${kills}†`, 'kills', 16)
        }

        await sleep(duration(HIT_MS))
        updateView((current) => ({ ...current, hit: { ...current.hit, [targetId]: false } }))
      }

      const shoot = async (from: Point, to: Point, kind: ProjectileKind) => {
        const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
        sound(PROJECTILE_SOUND[kind])
        await tween(duration(Math.max(200, distanceBetween(from, to) * 0.8)), (progress) =>
          setProjectile({ position: between(from, to, progress), angle, kind }),
        )
        setProjectile(null)
      }

      let castingNow = false

      for (const event of events) {
        if (!mounted.current) {
          return
        }

        // The casting pose ends once the spell's events are over.
        if (castingNow && event.kind !== 'spell' && event.kind !== 'death') {
          castingNow = false
          updateView((current) => ({ ...current, casting: null }))
        }

        switch (event.kind) {
          case 'move': {
            const type = typeOf(event.unitId) ?? 'pikeman'

            if (event.flying) {
              const from = positions[event.unitId]
              const to = pointFor(event.unitId, event.path[event.path.length - 1])
              const hexes = Math.max(1, distanceBetween(from, to) / 45)
              const flight = flightOf(type)
              const total = duration(FLY_MS_PER_HEX * hexes + 120)
              // Winged fliers beat their wings all the way, bobbing with each beat; the rest rush through the air.
              const beat = flight === 'magic' ? 0 : duration(FLAP_MS[flight])
              let nextBeat = 0

              if (flight === 'magic') {
                sound('fly')
              }

              await tween(total, (progress) => {
                const elapsed = progress * total

                if (beat > 0 && elapsed >= nextBeat && progress < 1) {
                  sound(flight === 'heavyWings' ? 'heavyFlap' : 'flap')
                  nextBeat += beat
                }

                const point = between(from, to, progress)
                const bob = beat > 0 ? Math.sin((elapsed / beat) * Math.PI * 2) * 2 : 0
                setPosition(event.unitId, { x: point.x, y: point.y - Math.sin(progress * Math.PI) * 18 + bob })
              })
              positions[event.unitId] = to
              setPosition(event.unitId, to)
            } else {
              for (const step of event.path.slice(1)) {
                const from = positions[event.unitId]
                const to = pointFor(event.unitId, step)
                sound(gaitOf(type))
                await tween(duration(STEP_MS), (progress) => {
                  const point = between(from, to, progress)
                  setPosition(event.unitId, { x: point.x, y: point.y - Math.sin(progress * Math.PI) * 3 })
                })
                positions[event.unitId] = to
              }
            }

            break
          }

          case 'attack': {
            const from = positions[event.attackerId]
            const to = positions[event.targetId]

            if (event.splash) {
              // Death clouds and dragon fire spread from the main target, with no projectile of their own.
            } else if (event.ranged) {
              // The shooter rocks back as it lets fly.
              setPose(event.attackerId, 'shoot')
              await shoot(from, to, PROJECTILE_FOR[typeOf(event.attackerId) ?? 'archer'] ?? 'arrow')
              setPose(event.attackerId, null)
            } else {
              // Draw back, then lunge in leaning into the blow, and settle back into place.
              const windUp = between(from, to, -0.08)
              const lunge = between(from, to, 0.38)
              setPose(event.attackerId, 'strike')
              await tween(duration(WIND_UP_MS), (progress) => setPosition(event.attackerId, between(from, windUp, progress)))
              sound('swing')
              await tween(duration(LUNGE_MS), (progress) =>
                setPosition(event.attackerId, between(windUp, lunge, progress * progress)),
              )
              await tween(duration(LUNGE_MS), (progress) => setPosition(event.attackerId, between(lunge, from, progress)))
              setPose(event.attackerId, null)
            }

            if (event.lucky) {
              sound('lucky')
              addFloatingText(from, 'Lucky!', 'good', -24)
            }

            if (event.deathblow) {
              addFloatingText(from, 'Deathblow!', 'good', -24)
            }

            await showHit(event.targetId, event.targetCount, event.targetTopHp, event.damage, event.kills)
            break
          }

          case 'spell': {
            const target = positions[event.targetId]
            // The hero raises their hand the first time a spell is cast, not again for each further stack it hits.
            const firstTarget = !castingNow

            if (firstTarget) {
              castingNow = true
              updateView((current) => ({ ...current, casting: event.caster }))
              await sleep(duration(CAST_MS))
            }

            if (event.spell === 'magicArrow') {
              await shoot(casterPoint(event.caster), target, 'magic')
            } else if (event.spell === 'meteorShower' || event.spell === 'inferno') {
              await shoot({ x: target.x - 60, y: target.y - 220 }, target, 'fire')
            } else if (event.spell === 'lightningBolt') {
              updateView((current) => ({ ...current, lightning: target }))
              sound('lightning')
              await sleep(duration(260))
              updateView((current) => ({ ...current, lightning: null }))
            }

            // Each spell leaves its own mark on the stack it lands on.
            const effectId = nextEffectId++
            updateView((current) => ({ ...current, spellEffects: [...current.spellEffects, { id: effectId, spell: event.spell, point: target }] }))
            setTimeout(() => {
              if (mounted.current) {
                updateView((current) => ({
                  ...current,
                  spellEffects: current.spellEffects.filter((effect) => effect.id !== effectId),
                }))
              }
            }, duration(SPELL_EFFECT_MS))

            if (event.damage > 0) {
              await showHit(event.targetId, event.targetCount, event.targetTopHp, event.damage, event.kills)
            } else {
              const helpful = SPELLS[event.spell].target === 'ally'
              const color = helpful ? 'var(--glow-good)' : 'var(--glow-bad)'
              sound(helpful ? 'blessing' : 'curse')
              updateView((current) => ({
                ...current,
                glow: { ...current.glow, [event.targetId]: color },
                stacks: { ...current.stacks, [event.targetId]: { count: event.targetCount, topHp: event.targetTopHp } },
              }))
              addFloatingText(target, SPELLS[event.spell].name, 'magic')
              await sleep(duration(NOTE_MS * 1.5))
              updateView((current) => ({ ...current, glow: { ...current.glow, [event.targetId]: '' } }))
            }

            break
          }

          case 'death':
            updateView((current) => ({ ...current, dying: { ...current.dying, [event.unitId]: true } }))
            sound('death')
            await sleep(duration(DEATH_MS))
            break

          case 'heal':
            addFloatingText(positions[event.unitId], `+${event.amount}`, 'good')
            sound('regenerate')
            await sleep(duration(NOTE_MS))
            break

          case 'regenerate':
            addFloatingText(positions[event.unitId], 'Regenerate', 'good')
            sound('regenerate')
            await sleep(duration(NOTE_MS))
            break

          case 'petrify':
            addFloatingText(positions[event.unitId], 'Petrified!', 'magic', -24)
            sound('petrify')
            await sleep(duration(NOTE_MS))
            break

          case 'stoneSkip':
            addFloatingText(positions[event.unitId], 'Stone', 'info')
            sound('petrify')
            await sleep(duration(NOTE_MS * 1.5))
            break

          case 'defend':
            addFloatingText(positions[event.unitId], 'Defend', 'info')
            sound('defend')
            await sleep(duration(NOTE_MS))
            break

          case 'wait':
            addFloatingText(positions[event.unitId], 'Wait', 'info')
            sound('wait')
            await sleep(duration(NOTE_MS))
            break

          case 'morale':
            addFloatingText(positions[event.unitId], 'Morale!', 'good')
            sound('morale')
            await sleep(duration(NOTE_MS * 1.5))
            break

          case 'retreat':
            break
        }
      }
    },
    [updateView, addFloatingText, silent],
  )

  const finish = useCallback(() => {
    setView(EMPTY_VIEW)
    setPlaying(false)
  }, [])

  return { view, floatingTexts, playing, play, finish }
}
