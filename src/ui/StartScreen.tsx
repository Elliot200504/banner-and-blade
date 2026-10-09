import { useState } from 'react'
import {
  ARMY_BUDGET,
  armyCost,
  armyProblem,
  createHero,
  createRandom,
  CREATURES,
  DIFFICULTIES,
  FACTION_ORDER,
  FACTIONS,
  HEROES,
  heroesOf,
  mostAffordable,
  PLAYER_NAMES,
  randomArmy,
  standardArmy,
  withStack,
  type Army,
  type CreatureType,
  type Difficulty,
  type Faction,
  type HeroId,
  type Player,
} from '../game'
import { specialtyText } from './heroText'
import { HowToPlay } from './HowToPlay'
import { Modal } from './Modal'
import { Icon, SpriteIcon } from './SpriteImage'

/** Who plays a side: someone at the keyboard, or the computer. */
export type Controller = 'human' | 'computer'

const CONTROLLER_LABELS: Record<Controller, string> = { human: 'Human', computer: 'Computer' }

const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }
const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  easy: 'Makes loose moves and never casts spells.',
  normal: 'Weighs every move carefully.',
  hard: 'Thinks harder about the dice and presses the attack.',
}

const formatGold = (gold: number) => gold.toLocaleString('en-US')

interface StartScreenProps {
  factions: Record<Player, Faction>
  controllers: Record<Player, Controller>
  heroes: Record<Player, HeroId>
  difficulties: Record<Player, Difficulty>
  armies: Record<Player, Army>
  onChangeFaction: (player: Player, faction: Faction) => void
  onChangeController: (player: Player, controller: Controller) => void
  onChangeDifficulty: (player: Player, difficulty: Difficulty) => void
  onChangeHero: (player: Player, hero: HeroId) => void
  onChangeArmy: (player: Player, army: Army) => void
  onStart: () => void
  onOpenSettings: () => void
}

export function StartScreen({
  factions,
  controllers,
  heroes,
  difficulties,
  armies,
  onChangeFaction,
  onChangeController,
  onChangeDifficulty,
  onChangeHero,
  onChangeArmy,
  onStart,
  onOpenSettings,
}: StartScreenProps) {
  const [rulesOpen, setRulesOpen] = useState(false)
  const problems = (['red', 'blue'] as const).flatMap((player) => {
    const problem = armyProblem(armies[player], factions[player])

    return problem ? [`${PLAYER_NAMES[player]}: ${problem}`] : []
  })

  const sidePanel = (player: Player) => (
    <section key={player} className={`panel army-picker__side army-picker__side--${player}`}>
      <h2 className="panel__title">{PLAYER_NAMES[player]} player</h2>
      <div className="army-picker__controls">
        <div className="army-picker__factions" role="radiogroup" aria-label={`Who plays ${PLAYER_NAMES[player]}`}>
          {(['human', 'computer'] as const).map((controller) => (
            <button
              key={controller}
              role="radio"
              aria-checked={controllers[player] === controller}
              className={`faction-option${controllers[player] === controller ? ' faction-option--active' : ''}`}
              onClick={() => onChangeController(player, controller)}
            >
              {CONTROLLER_LABELS[controller]}
            </button>
          ))}
        </div>
        <div
          className={`army-picker__factions${controllers[player] === 'computer' ? '' : ' army-picker__difficulty--hidden'}`}
          role="radiogroup"
          aria-label={`${PLAYER_NAMES[player]} computer difficulty`}
          aria-hidden={controllers[player] !== 'computer'}
        >
          {DIFFICULTIES.map((difficulty) => (
            <button
              key={difficulty}
              role="radio"
              aria-checked={difficulties[player] === difficulty}
              title={DIFFICULTY_HINTS[difficulty]}
              tabIndex={controllers[player] === 'computer' ? 0 : -1}
              className={`faction-option${difficulties[player] === difficulty ? ' faction-option--active' : ''}`}
              onClick={() => onChangeDifficulty(player, difficulty)}
            >
              {DIFFICULTY_LABELS[difficulty]}
            </button>
          ))}
        </div>
      </div>
      <div
        className="army-picker__factions army-picker__factions--grid army-picker__towns"
        role="radiogroup"
        aria-label={`${PLAYER_NAMES[player]} faction`}
      >
        {FACTION_ORDER.map((faction) => (
          <button
            key={faction}
            role="radio"
            aria-checked={factions[player] === faction}
            className={`faction-option${factions[player] === faction ? ' faction-option--active' : ''}`}
            onClick={() => onChangeFaction(player, faction)}
          >
            <SpriteIcon spriteId={faction} owner={player} size={32} />
            {FACTIONS[faction].name}
          </button>
        ))}
      </div>
      <div className="hero-picker" role="radiogroup" aria-label={`${PLAYER_NAMES[player]} hero`}>
        {heroesOf(factions[player]).map((id) => (
          <button
            key={id}
            role="radio"
            aria-checked={heroes[player] === id}
            className={`hero-option${heroes[player] === id ? ' hero-option--active' : ''}`}
            onClick={() => onChangeHero(player, id)}
          >
            <SpriteIcon spriteId={id} owner={player} size={32} />
            <span className="hero-option__text">
              <span className="hero-option__name">{HEROES[id].name}</span>
              <span className="hero-option__class">{HEROES[id].title}</span>
            </span>
          </button>
        ))}
      </div>
      <ArmyBuilder
        player={player}
        faction={factions[player]}
        heroId={heroes[player]}
        army={armies[player]}
        onChange={(army) => onChangeArmy(player, army)}
      />
    </section>
  )

  return (
    <main className="start-screen">
      {sidePanel('red')}

      <div className="start-screen__center">
        <h1 className="start-screen__title">Banner &amp; Blade</h1>
        <p className="start-screen__subtitle">Hex battles against the computer or a friend on the same screen</p>
        <button className="button button--large" onClick={onStart} disabled={problems.length > 0} autoFocus>
          To battle!
        </button>
        {problems.length > 0 && <p className="start-screen__problem">{problems.join(' ')}</p>}
        <button className="button button--secondary" onClick={() => setRulesOpen(true)}>
          How to play
        </button>
        <button className="button button--secondary" onClick={onOpenSettings}>
          Settings
        </button>
      </div>

      {sidePanel('blue')}

      {rulesOpen && (
        <Modal title="How to play" onClose={() => setRulesOpen(false)} className="rules">
          <HowToPlay />
        </Modal>
      )}
    </main>
  )
}

interface ArmyBuilderProps {
  player: Player
  faction: Faction
  heroId: HeroId
  army: Army
  onChange: (army: Army) => void
}

function ArmyBuilder({ player, faction, heroId, army, onChange }: ArmyBuilderProps) {
  const hero = createHero(heroId)
  const goldLeft = ARMY_BUDGET - armyCost(army)
  const countOf = (type: CreatureType) => army.find((stack) => stack.type === type)?.count ?? 0
  const setCount = (type: CreatureType, count: number) => {
    const allowed = Math.max(0, Math.min(Math.floor(count) || 0, mostAffordable(army, type)))
    onChange(withStack(army, faction, type, allowed))
  }

  return (
    <div className="army-preview">
      <p className="army-preview__description">{FACTIONS[faction].description}</p>
      <p className="army-preview__specialty">
        <Icon name="star" /> {specialtyText(hero)}
      </p>
      <div className="recruit__gold">
        <span>
          <Icon name="gold" /> {formatGold(goldLeft)} <span className="recruit__budget">/ {formatGold(ARMY_BUDGET)} gold left</span>
        </span>
        <span className="recruit__presets">
          <button className="recruit__preset" onClick={() => onChange(standardArmy(faction))}>
            Standard
          </button>
          <button
            className="recruit__preset"
            onClick={() => onChange(randomArmy(faction, createRandom(Math.floor(Math.random() * 2 ** 32))))}
          >
            Random
          </button>
          <button className="recruit__preset" onClick={() => onChange([])}>
            Clear
          </button>
        </span>
      </div>
      <ul className="recruit">
        {FACTIONS[faction].creatures.map((type) => {
          const stats = CREATURES[type]
          const count = countOf(type)
          const most = mostAffordable(army, type)
          const specialist = hero.specialty.kind === 'creature' && hero.specialty.creature === type

          return (
            <li
              key={type}
              className={`recruit__row${count === 0 ? ' recruit__row--empty' : ''}${specialist ? ' army-preview__specialist' : ''}`}
            >
              <SpriteIcon spriteId={type} owner={player} size={32} mirrored={player === 'blue'} />
              <span className="recruit__name">
                {stats.plural}
                <span className="recruit__cost">{stats.cost} gold each</span>
              </span>
              <span className="recruit__count">
                <button
                  className="recruit__step"
                  aria-label={`Fewer ${stats.plural}`}
                  title="Shift-click for 10 at a time"
                  disabled={count === 0}
                  onClick={(event) => setCount(type, count - (event.shiftKey ? 10 : 1))}
                >
                  −
                </button>
                <input
                  className="recruit__input"
                  type="number"
                  min={0}
                  max={most}
                  value={count}
                  aria-label={`${PLAYER_NAMES[player]} ${stats.plural}`}
                  onChange={(event) => setCount(type, Number(event.target.value))}
                />
                <button
                  className="recruit__step"
                  aria-label={`More ${stats.plural}`}
                  title="Shift-click for 10 at a time"
                  disabled={count >= most}
                  onClick={(event) => setCount(type, count + (event.shiftKey ? 10 : 1))}
                >
                  +
                </button>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
