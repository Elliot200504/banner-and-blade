import type { CSSProperties, ReactNode } from 'react'
import type { SpellId } from '../../game'
import type { SpellEffect } from './useAnimator'

/** Six points around a circle, for sparks, shards and puffs. */
const AROUND = Array.from({ length: 6 }, (_, index) => {
  const angle = (index / 6) * Math.PI * 2

  return { x: Math.cos(angle), y: Math.sin(angle) }
})

/** What each spell looks like as it lands, drawn around the stack's feet. CSS plays each part once. */
const DRAW: Record<SpellId, () => ReactNode> = {
  magicArrow: () => <circle className="spell-fx__burst spell-fx--arcane" r={14} />,
  lightningBolt: () => (
    <>
      <circle className="spell-fx__flash" r={30} />
      <circle className="spell-fx__burst spell-fx--storm" r={18} />
    </>
  ),
  haste: () =>
    [-14, -4, 6].map((y, index) => (
      <line
        key={y}
        className="spell-fx__streak"
        x1={-26}
        y1={y}
        x2={-8}
        y2={y}
        style={{ animationDelay: `${index * 60}ms` }}
      />
    )),
  slow: () =>
    [0, 1, 2].map((index) => <circle key={index} className="spell-fx__sink" r={22} style={{ animationDelay: `${index * 110}ms` }} />),
  bless: () => (
    <>
      <ellipse className="spell-fx__halo" cx={0} cy={-34} rx={12} ry={4} />
      {AROUND.map((point, index) => (
        <rect
          key={index}
          className="spell-fx__rise spell-fx--gold"
          x={point.x * 14 - 1.5}
          y={-6 + point.y * 5}
          width={3}
          height={3}
          style={{ animationDelay: `${index * 50}ms` }}
        />
      ))}
    </>
  ),
  curse: () =>
    AROUND.map((point, index) => (
      <circle
        key={index}
        className="spell-fx__fall spell-fx--shadow"
        cx={point.x * 12}
        cy={-30 + point.y * 6}
        r={5}
        style={{ animationDelay: `${index * 45}ms` }}
      />
    )),
  stoneSkin: () =>
    AROUND.map((point, index) => (
      <rect
        key={index}
        className="spell-fx__gather spell-fx--stone"
        x={-2}
        y={-14}
        width={4}
        height={4}
        style={{ '--from-x': `${point.x * 26}px`, '--from-y': `${point.y * 18}px` } as CSSProperties}
      />
    )),
  cure: () =>
    [-10, 0, 10].map((x, index) => (
      <path
        key={x}
        className="spell-fx__rise spell-fx--heal"
        d={`M${x - 1.5},-8 h3 v3 h3 v3 h-3 v3 h-3 v-3 h-3 v-3 h3 z`}
        style={{ animationDelay: `${index * 80}ms` }}
      />
    )),
  deathRipple: () =>
    [0, 1].map((index) => (
      <ellipse key={index} className="spell-fx__ripple" rx={24} ry={8} cy={10} style={{ animationDelay: `${index * 140}ms` }} />
    )),
  animateDead: () =>
    AROUND.slice(0, 4).map((point, index) => (
      <ellipse
        key={index}
        className="spell-fx__rise spell-fx--necro"
        cx={point.x * 10}
        cy={6}
        rx={3}
        ry={7}
        style={{ animationDelay: `${index * 70}ms` }}
      />
    )),
  meteorShower: () => (
    <>
      <circle className="spell-fx__burst spell-fx--fire" r={22} />
      {AROUND.map((point, index) => (
        <rect
          key={index}
          className="spell-fx__scatter spell-fx--ember"
          x={-1.5}
          y={-1.5}
          width={3}
          height={3}
          style={{ '--to-x': `${point.x * 30}px`, '--to-y': `${point.y * 20}px` } as CSSProperties}
        />
      ))}
    </>
  ),
  inferno: () => (
    <>
      <circle className="spell-fx__flash spell-fx--fire" r={40} />
      <circle className="spell-fx__burst spell-fx--fire" r={32} />
      {AROUND.map((point, index) => (
        <rect
          key={index}
          className="spell-fx__scatter spell-fx--ember"
          x={-2}
          y={-2}
          width={4}
          height={4}
          style={{ '--to-x': `${point.x * 44}px`, '--to-y': `${point.y * 28}px` } as CSSProperties}
        />
      ))}
    </>
  ),
}

/** Every spell effect playing right now, each over the stack it landed on. */
export function SpellEffects({ effects }: { effects: SpellEffect[] }) {
  return (
    <g className="spell-effects" aria-hidden="true">
      {effects.map((effect) => (
        <g key={effect.id} className="spell-fx" transform={`translate(${effect.point.x} ${effect.point.y})`}>
          {DRAW[effect.spell]()}
        </g>
      ))}
    </g>
  )
}
