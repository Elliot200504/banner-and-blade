import { useEffect, useRef } from 'react'
import {
  ABILITY_DESCRIPTIONS,
  CREATURES,
  effectiveAttack,
  effectiveDefense,
  effectiveSpeed,
  FACTIONS,
  isWarMachine,
  PLAYER_NAMES,
  SPELLS,
  usesAmmunition,
  type GameState,
  type Player,
  type Unit,
} from '../game'
import { specialtyText } from './heroText'
import { HeroStats } from './HeroStats'
import { Icon, SpellIcon, SpriteIcon } from './SpriteImage'

export function HeroPanel({ state, player, active }: { state: GameState; player: Player; active: boolean }) {
  const hero = state.heroes[player]

  return (
    <section className={`panel hero-panel hero-panel--${player}${active ? ' hero-panel--active' : ''}`}>
      <div className="hero-panel__name">
        <div className={`hero-panel__portrait hero-panel__portrait--${player}`}>
          <SpriteIcon spriteId={hero.id} owner={player} size={36} />
        </div>
        <div>
          <div>{hero.name}</div>
          <div className="hero-panel__title">
            <SpriteIcon spriteId={state.factions[player]} owner={player} size={16} />
            {PLAYER_NAMES[player]} · {FACTIONS[state.factions[player]].name} {hero.title}
          </div>
          <div className="hero-panel__specialty" title={specialtyText(hero)}>
            <Icon name="star" size={16} /> {specialtyText(hero)}
          </div>
        </div>
      </div>
      <div className="hero-panel__vitals">
        <HeroStats hero={hero} />
        <div className="mana-bar" title={`Mana ${hero.mana}/${hero.maxMana}`}>
          <div className="mana-bar__fill" style={{ width: `${(hero.mana / hero.maxMana) * 100}%` }} />
          <span className="mana-bar__label">
            {hero.mana}/{hero.maxMana} mana{hero.hasCastThisRound ? ' · cast' : ''}
          </span>
        </div>
      </div>
    </section>
  )
}

export function UnitCard({ unit, state }: { unit: Unit; state: GameState }) {
  const stats = CREATURES[unit.type]
  const hero = state.heroes[unit.owner]
  const attack = effectiveAttack(unit, hero)
  const defense = effectiveDefense(unit, hero)
  const speed = effectiveSpeed(unit)
  const withBonus = (value: number, base: number) => (value === base ? `${value}` : `${base} (${value})`)
  const machine = isWarMachine(unit.type)
  const statusEffects = [
    unit.defending && 'Defending',
    unit.waited && 'Waiting',
    unit.specialty && `${hero.name}'s specialty`,
    unit.petrified && (unit.lostTurn ? 'Stone: breaks free on its next turn' : 'Petrified: loses its next turn'),
    unit.retaliationsLeft === 0 && 'No retaliation left',
  ].filter(Boolean)

  return (
    <section className={`panel unit-card unit-card--${unit.owner}`}>
      <div className="unit-card__header">
        <div className={`unit-card__portrait unit-card__portrait--${unit.owner}`}>
          <SpriteIcon spriteId={unit.type} owner={unit.owner} size={56} mirrored={unit.owner === 'blue'} />
        </div>
        <div>
          <h2 className="panel__title">{unit.label}</h2>
          <div className="unit-card__count">
            {unit.count} × {stats.name}
          </div>
        </div>
      </div>
      <dl className="unit-card__stats">
        <dt>Attack</dt>
        <dd>{withBonus(attack, stats.attack)}</dd>
        <dt>Defense</dt>
        <dd>{withBonus(defense, stats.defense)}</dd>
        {stats.maxDamage > 0 && (
          <>
            <dt>Damage</dt>
            <dd>
              {stats.minDamage}–{stats.maxDamage}
            </dd>
          </>
        )}
        <dt>Health</dt>
        <dd>
          {unit.topHp}/{stats.hp}
        </dd>
        {!machine && (
          <>
            <dt>Speed</dt>
            <dd>{withBonus(speed, stats.speed)}</dd>
          </>
        )}
        {stats.range > 0 && (
          <>
            <dt>Shots</dt>
            <dd>{usesAmmunition(state.units, unit) ? `${unit.shots}/${stats.shots}` : 'Unlimited'}</dd>
            <dt>Range</dt>
            <dd>{stats.range} hexes</dd>
          </>
        )}
      </dl>
      {stats.abilities.length > 0 && (
        <ul className="unit-card__abilities">
          {stats.abilities.map((ability) => (
            <li key={ability}>{ABILITY_DESCRIPTIONS[ability]}</li>
          ))}
        </ul>
      )}
      {unit.effects.length > 0 && (
        <ul className="unit-card__effects">
          {unit.effects.map((active) => (
            <li key={active.effect}>
              <SpellIcon spell={active.effect} size={16} /> {SPELLS[active.effect].name}: {active.roundsLeft} round
              {active.roundsLeft === 1 ? '' : 's'} left
            </li>
          ))}
        </ul>
      )}
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
