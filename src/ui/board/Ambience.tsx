import { memo, type CSSProperties } from 'react'
import type { Faction, Player } from '../../game'
import { BOARD_HEIGHT, BOARD_WIDTH } from './layout'

/** How a homeland's motes move: rising like embers, falling like snow, wandering like fireflies or drifting like dust. */
type Drift = 'rise' | 'fall' | 'wander' | 'drift'

interface Motes {
  colors: string[]
  drift: Drift
  /** Seconds for one mote's journey. */
  seconds: number
}

const MOTES: Record<Faction, Motes> = {
  castle: { colors: ['#f6e7a0', '#fff6d0'], drift: 'wander', seconds: 9 },
  rampart: { colors: ['#d8f070', '#f0ff9a'], drift: 'wander', seconds: 7 },
  stronghold: { colors: ['#e0c890', '#c8a868'], drift: 'drift', seconds: 11 },
  necropolis: { colors: ['#a8c8b0', '#8a9a90'], drift: 'fall', seconds: 13 },
  dungeon: { colors: ['#c090f0', '#e0b0ff'], drift: 'rise', seconds: 10 },
  inferno: { colors: ['#ff8a30', '#ffc040', '#ff5020'], drift: 'rise', seconds: 5 },
  tower: { colors: ['#ffffff', '#dfefff'], drift: 'fall', seconds: 9 },
  fortress: { colors: ['#b8e070', '#d0e890'], drift: 'wander', seconds: 8 },
  conflux: { colors: ['#9ff0ff', '#ffd0ff', '#fff3a0'], drift: 'wander', seconds: 8 },
}

const MOTES_PER_SIDE = 14

/** A steady pseudo-random number between 0 and 1, so the motes keep their places from render to render. */
function scatter(index: number, salt: number): number {
  let value = Math.imul(index * 374761393 + salt * 668265263, 1274126177)
  value = Math.imul(value ^ (value >>> 13), 1103515245)

  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

interface AmbienceProps {
  factions: Record<Player, Faction>
}

/** Life on the field: each homeland's motes drifting over its half, and cloud shadows passing over everything. */
export const Ambience = memo(function Ambience({ factions }: AmbienceProps) {
  const motes = (['red', 'blue'] as const).flatMap((side, sideIndex) => {
    const { colors, drift, seconds } = MOTES[factions[side]]
    const left = sideIndex === 0 ? 0 : BOARD_WIDTH / 2

    return Array.from({ length: MOTES_PER_SIDE }, (_, index) => {
      const salt = sideIndex * 100 + index
      const style = {
        animationDuration: `${(seconds * (0.7 + scatter(salt, 3) * 0.6)).toFixed(2)}s`,
        animationDelay: `${(-scatter(salt, 4) * seconds).toFixed(2)}s`,
      } satisfies CSSProperties

      return (
        <rect
          key={`${side}-${index}`}
          className={`ambience__mote ambience__mote--${drift}`}
          x={(left + scatter(salt, 1) * (BOARD_WIDTH / 2)).toFixed(1)}
          y={(scatter(salt, 2) * BOARD_HEIGHT).toFixed(1)}
          width={2}
          height={2}
          fill={colors[index % colors.length]}
          style={style}
        />
      )
    })
  })

  return (
    <g className="ambience" style={{ '--cloud-travel': `${BOARD_WIDTH + 440}px` } as CSSProperties} aria-hidden="true">
      <defs>
        <radialGradient id="cloud-shadow">
          <stop offset="0" stopColor="#000" stopOpacity={0.16} />
          <stop offset="1" stopColor="#000" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse className="ambience__cloud" cx={0} cy={BOARD_HEIGHT * 0.3} rx={170} ry={90} fill="url(#cloud-shadow)" />
      <ellipse
        className="ambience__cloud ambience__cloud--late"
        cx={0}
        cy={BOARD_HEIGHT * 0.72}
        rx={210}
        ry={100}
        fill="url(#cloud-shadow)"
      />
      {motes}
    </g>
  )
})
