import { useEffect, useRef } from 'react'
import { PLAYER_NAMES, UNIT_STATS, type GameState, type Unit } from '../game'
import { UNIT_ICONS } from './Board'

export function TurnBanner({ state, actor }: { state: GameState; actor: Unit | undefined }) {
  if (!actor || state.winner) return <div className="turn-banner">Round {state.round}</div>
  return (
    <div className={`turn-banner turn-banner--${actor.owner}`}>
      <span>Round {state.round}</span>
      <span>
        {PLAYER_NAMES[actor.owner]}'s turn: {UNIT_ICONS[actor.type]} {UNIT_STATS[actor.type].name}
      </span>
    </div>
  )
}

export function UnitCard({ unit }: { unit: Unit }) {
  const stats = UNIT_STATS[unit.type]
  const statusEffects = [unit.defending && 'Defending', unit.retaliated && 'Has struck back'].filter(Boolean)
  return (
    <section className={`panel unit-card unit-card--${unit.owner}`}>
      <h2 className="panel__title">
        {UNIT_ICONS[unit.type]} {unit.label}
      </h2>
      <dl className="unit-card__stats">
        <dt>HP</dt>
        <dd>
          {unit.hp}/{stats.maxHp}
        </dd>
        <dt>Damage</dt>
        <dd>{stats.damage}</dd>
        <dt>Move</dt>
        <dd>{stats.move}</dd>
        <dt>Initiative</dt>
        <dd>{stats.initiative}</dd>
        <dt>Attack</dt>
        <dd>{stats.ranged ? 'Ranged' : 'Melee'}</dd>
      </dl>
      {statusEffects.length > 0 && <p className="unit-card__status">{statusEffects.join(' · ')}</p>}
    </section>
  )
}

export function BattleLog({ log }: { log: string[] }) {
  const listRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [log])
  return (
    <section className="panel battle-log">
      <h2 className="panel__title">Battle log</h2>
      <ol ref={listRef} className="battle-log__list">
        {log.map((line, index) => (
          <li key={index} className={line.startsWith('—') ? 'battle-log__round' : undefined}>
            {line}
          </li>
        ))}
      </ol>
    </section>
  )
}
