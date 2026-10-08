import { buildQueue, type GameState, type Unit } from '../game'
import { SpriteIcon } from './SpriteImage'

interface TurnQueueProps {
  state: GameState
  onHover: (unitId: string | null) => void
}

/** Who goes next: the rest of this round, then the next one. */
export function TurnQueue({ state, onHover }: TurnQueueProps) {
  if (state.winner) return null
  const findUnit = (id: string) => state.units.find((unit) => unit.id === id)
  const isUnit = (unit: Unit | undefined): unit is Unit => unit !== undefined
  const thisRound = state.queue.map(findUnit).filter(isUnit)
  const nextRound = buildQueue(state.units, state.round + 1).map(findUnit).filter(isUnit)

  return (
    <section className="turn-queue" aria-label="Turn order">
      <h2 className="turn-queue__title">Turn order</h2>
      <div className="turn-queue__tokens">
        {thisRound.map((unit, index) => (
          <QueueToken
            key={unit.id}
            unit={unit}
            label={index === 0 ? 'Now' : index === 1 ? 'Next' : null}
            onHover={onHover}
          />
        ))}
        <span className="turn-queue__divider">Round {state.round + 1}</span>
        {nextRound.map((unit) => (
          <QueueToken key={`next-${unit.id}`} unit={unit} label={null} onHover={onHover} faded />
        ))}
      </div>
    </section>
  )
}

interface QueueTokenProps {
  unit: Unit
  label: string | null
  faded?: boolean
  onHover: (unitId: string | null) => void
}

function QueueToken({ unit, label, faded = false, onHover }: QueueTokenProps) {
  let className = `queue-token queue-token--${unit.owner}`
  if (label === 'Now') className += ' queue-token--current'
  if (faded) className += ' queue-token--faded'
  return (
    <div
      className={className}
      title={`${unit.label} (${unit.count})${unit.waited ? ', waiting' : ''}`}
      onMouseEnter={() => onHover(unit.id)}
      onMouseLeave={() => onHover(null)}
    >
      {label && <span className="queue-token__label">{label}</span>}
      <SpriteIcon spriteId={unit.type} owner={unit.owner} size={34} mirrored={unit.owner === 'blue'} />
      <span className="queue-token__count">{unit.count}</span>
      {unit.waited && !faded && <span className="queue-token__waited">⏳</span>}
    </div>
  )
}
