import { buildQueue, type GameState, type Unit } from '../game'
import { UNIT_ICONS } from './Board'

/** The order units act in: the rest of this round, then the next one. */
export function TurnQueue({ state }: { state: GameState }) {
  if (state.winner) return null
  const findUnit = (id: string) => state.units.find((unit) => unit.id === id)
  const thisRound = state.queue.map(findUnit).filter((unit): unit is Unit => unit !== undefined)
  const nextRound = buildQueue(state.units, state.round + 1)
    .map(findUnit)
    .filter((unit): unit is Unit => unit !== undefined)

  return (
    <div className="turn-queue" aria-label="Turn order">
      {thisRound.map((unit, index) => (
        <QueueToken key={unit.id} unit={unit} current={index === 0} />
      ))}
      <span className="turn-queue__divider">R{state.round + 1}</span>
      {nextRound.map((unit) => (
        <QueueToken key={`next-${unit.id}`} unit={unit} current={false} />
      ))}
    </div>
  )
}

function QueueToken({ unit, current }: { unit: Unit; current: boolean }) {
  return (
    <span
      className={`queue-token queue-token--${unit.owner}${current ? ' queue-token--current' : ''}`}
      title={unit.label}
    >
      {UNIT_ICONS[unit.type]}
    </span>
  )
}
