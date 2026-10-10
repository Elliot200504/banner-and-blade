import { useEffect, useRef, useState } from 'react'
import {
  ABILITY_DESCRIPTIONS,
  ARMY_BUDGETS,
  ARMY_SIZES,
  armyCost,
  baseOf,
  armyProblem,
  createHero,
  createRandom,
  CREATURES,
  DIFFICULTIES,
  FACTION_ORDER,
  FACTIONS,
  HEROES,
  heroesOf,
  isWarMachine,
  mostAffordable,
  PLAYER_NAMES,
  randomArmy,
  UPGRADES,
  WAR_MACHINES,
  withStack,
  withUpgrade,
  type BaseCreature,
  type Army,
  type ArmySize,
  type CreatureType,
  type Difficulty,
  type Faction,
  type HeroId,
  type Player,
} from '../../game'
import { About, GitHubLink } from '../modals/About'
import { specialtyText } from '../panels/heroText'
import { HeroStats } from '../panels/HeroStats'
import { HowToPlay } from '../modals/HowToPlay'
import { Modal } from '../modals/Modal'
import { Icon, SpriteIcon } from '../art/SpriteImage'

/** Who plays a side: someone at the keyboard, the computer, or a friend online. */
export type Controller = 'human' | 'computer' | 'remote'

const CONTROLLER_LABELS: Record<Controller, string> = { human: 'Human', computer: 'Computer', remote: 'Online' }

/** An online game on the start screen: which side is played here, and whether this player starts battles. */
export interface OnlineSide {
  side: Player
  isHost: boolean
}

/**
 * The choices actually made for a side. Nothing shows as picked until it is, and each
 * choice reveals the next: who plays, then the town, then the hero, then the army.
 */
export interface SidePicks {
  controller: boolean
  difficulty: boolean
  town: boolean
  hero: boolean
  /** The town, hero and army were rolled at random, and stay secret until the battle. */
  random: boolean
}

export type SetupProgress = Record<Player, SidePicks>

const NOTHING_PICKED: SidePicks = { controller: false, difficulty: false, town: false, hero: false, random: false }

export const NEW_SETUP: SetupProgress = { red: NOTHING_PICKED, blue: NOTHING_PICKED }

const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard', expert: 'Expert' }
const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  easy: 'Makes loose moves and never casts spells.',
  normal: 'Weighs every move carefully.',
  hard: 'Thinks harder about the dice and presses the attack.',
  expert: 'Fights like a veteran: strikes first, kites out of reach, shields its shooters and baits out retaliation.',
}

const ARMY_SIZE_LABELS: Record<ArmySize, string> = { small: 'Small', medium: 'Medium', large: 'Large' }

const formatGold = (gold: number) => gold.toLocaleString('en-US')

/** A creature's stats and abilities in a few lines, for the recruit list's tooltips. */
function creatureSummary(type: CreatureType): string {
  const stats = CREATURES[type]
  const damage = stats.minDamage === stats.maxDamage ? `${stats.minDamage}` : `${stats.minDamage}–${stats.maxDamage}`
  const shooting = stats.shots > 0 ? ` · ${stats.shots} shots, range ${stats.range}` : ''
  const abilities = stats.abilities.map((ability) => ABILITY_DESCRIPTIONS[ability])

  if (isWarMachine(type)) {
    const fighting = stats.maxDamage > 0 ? `Attack ${stats.attack} · Damage ${damage} · ` : ''

    return [`${fighting}Defense ${stats.defense} · Health ${stats.hp}`, ...abilities].join('\n')
  }

  const lines = [
    `Attack ${stats.attack} · Defense ${stats.defense} · Damage ${damage}`,
    `Health ${stats.hp} · Speed ${stats.speed}${shooting}`,
    ...abilities,
  ]

  return lines.join('\n')
}

interface StartScreenProps {
  factions: Record<Player, Faction>
  controllers: Record<Player, Controller>
  heroes: Record<Player, HeroId>
  difficulties: Record<Player, Difficulty>
  armies: Record<Player, Army>
  armySizes: Record<Player, ArmySize>
  setup: SetupProgress
  onChangeSetup: (setup: SetupProgress) => void
  onChangeFaction: (player: Player, faction: Faction) => void
  onChangeController: (player: Player, controller: Controller) => void
  onChangeDifficulty: (player: Player, difficulty: Difficulty) => void
  onChangeHero: (player: Player, hero: HeroId) => void
  onChangeArmy: (player: Player, army: Army) => void
  onChangeArmySize: (player: Player, size: ArmySize) => void
  /** A random town and hero, with that town's standard army of the given size. */
  onRandomSide: (player: Player, size: ArmySize) => void
  onStart: () => void
  onOpenSettings: () => void
  online: OnlineSide | null
  onOpenOnline: () => void
  onLeaveOnline: () => void
}

export function StartScreen({
  factions,
  controllers,
  heroes,
  difficulties,
  armies,
  armySizes,
  setup,
  onChangeSetup,
  onChangeFaction,
  onChangeController,
  onChangeDifficulty,
  onChangeHero,
  onChangeArmy,
  onChangeArmySize,
  onRandomSide,
  onStart,
  onOpenSettings,
  online,
  onOpenOnline,
  onLeaveOnline,
}: StartScreenProps) {
  const [rulesOpen, setRulesOpen] = useState(false)
  // Each side is a drawer: slid into its edge as a card of the picks, and open only while choosing.
  const [drawersOpen, setDrawersOpen] = useState<Record<Player, boolean>>({ red: false, blue: false })
  const drawers = { red: useRef<HTMLElement>(null), blue: useRef<HTMLElement>(null) }

  // Clicking anywhere outside an open drawer slides it shut.
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      setDrawersOpen((current) => ({
        red: current.red && (drawers.red.current?.contains(target) ?? false),
        blue: current.blue && (drawers.blue.current?.contains(target) ?? false),
      }))
    }
    document.addEventListener('pointerdown', handlePointerDown)

    return () => document.removeEventListener('pointerdown', handlePointerDown)
    // The refs are stable, so the listener only needs adding once.
  }, [])
  const [aboutOpen, setAboutOpen] = useState(false)
  const problems = (['red', 'blue'] as const).flatMap((player) => {
    const problem = armyProblem(armies[player], factions[player], ARMY_BUDGETS[armySizes[player]])

    return problem ? [`${PLAYER_NAMES[player]}: ${problem}`] : []
  })
  const ready = setup.red.hero && setup.blue.hero

  const pick = (player: Player, changes: Partial<SidePicks>) => onChangeSetup({ ...setup, [player]: { ...setup[player], ...changes } })

  /** Whether the side's player is settled: a human, or a computer with its difficulty. */
  const playerChosen = (player: Player) =>
    setup[player].controller && (controllers[player] === 'human' || setup[player].difficulty)

  const optionClass = (picked: boolean) => `faction-option${picked ? ' faction-option--active' : ''}`

  const playerStep = (player: Player) => (
    <div className="setup-step army-picker__controls">
      {/* Big buttons until the choice is made, then a compact row so the next steps get the room. */}
      <div
        className={`army-picker__factions${setup[player].controller ? '' : ' controller-choice--open'}`}
        role="radiogroup"
        aria-label={`Who plays ${PLAYER_NAMES[player]}`}
      >
        {(['human', 'computer'] as const).map((controller) => {
          const picked = setup[player].controller && controllers[player] === controller

          return (
            <button
              key={controller}
              role="radio"
              aria-checked={picked}
              className={optionClass(picked)}
              onClick={() => {
                onChangeController(player, controller)
                pick(player, { controller: true })
              }}
            >
              {CONTROLLER_LABELS[controller]}
            </button>
          )
        })}
      </div>
      {setup[player].controller && controllers[player] === 'computer' && (
        <div className="army-picker__factions" role="radiogroup" aria-label={`${PLAYER_NAMES[player]} computer difficulty`}>
          {DIFFICULTIES.map((difficulty) => {
            const picked = setup[player].difficulty && difficulties[player] === difficulty

            return (
              <button
                key={difficulty}
                role="radio"
                aria-checked={picked}
                title={DIFFICULTY_HINTS[difficulty]}
                className={`${optionClass(picked)} difficulty-option`}
                onClick={() => {
                  onChangeDifficulty(player, difficulty)
                  pick(player, { difficulty: true })
                }}
              >
                {difficulty === 'expert' && <Icon name="skull" size={12} />}
                {DIFFICULTY_LABELS[difficulty]}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  const randomStep = (player: Player) => (
    <div className="setup-step">
      <h3 className="drawer-label">Random</h3>
      <div className="army-picker__factions" role="group" aria-label={`Random ${PLAYER_NAMES[player]} team`}>
        {ARMY_SIZES.map((size) => {
          const picked = setup[player].random && armySizes[player] === size

          return (
            <button
              key={size}
              aria-pressed={picked}
              className={optionClass(picked)}
              onClick={() => {
                onRandomSide(player, size)
                pick(player, { town: true, hero: true, random: true })
              }}
            >
              {ARMY_SIZE_LABELS[size]}
            </button>
          )
        })}
      </div>
    </div>
  )

  const townStep = (player: Player) => (
    <div className="setup-step">
      <h3 className="drawer-label">Town</h3>
      <div
        className="army-picker__factions army-picker__factions--grid army-picker__towns"
        role="radiogroup"
        aria-label={`${PLAYER_NAMES[player]} faction`}
      >
        {FACTION_ORDER.map((faction) => {
          const picked = setup[player].town && !setup[player].random && factions[player] === faction

          return (
            <button
              key={faction}
              role="radio"
              aria-checked={picked}
              className={optionClass(picked)}
              onClick={() => {
                // A new town comes with its own heroes, so the hero has to be picked again.
                if (!picked) {
                  onChangeFaction(player, faction)
                  pick(player, { town: true, hero: false, random: false })
                }
              }}
            >
              <SpriteIcon spriteId={faction} owner={player} size={20} />
              {FACTIONS[faction].name}
            </button>
          )
        })}
      </div>
    </div>
  )

  const heroStep = (player: Player) => (
    <div className="setup-step">
      <h3 className="drawer-label">Hero</h3>
      <div className="hero-picker" role="radiogroup" aria-label={`${PLAYER_NAMES[player]} hero`}>
        {heroesOf(factions[player]).map((id) => {
          const picked = setup[player].hero && heroes[player] === id

          return (
            <button
              key={id}
              role="radio"
              aria-checked={picked}
              className={`hero-option${picked ? ' hero-option--active' : ''}`}
              onClick={() => {
                onChangeHero(player, id)
                pick(player, { hero: true })
              }}
            >
              <SpriteIcon spriteId={id} owner={player} size={32} />
              <span className="hero-option__text">
                <span className="hero-option__name">{HEROES[id].name}</span>
                <span className="hero-option__class">{HEROES[id].title}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  /** The closed drawer: a slim card with the side's picks, which slides the drawer back open. */
  const sideSummary = (player: Player) => {
    const picks = setup[player]
    const lines: string[] = []

    if (picks.controller) {
      lines.push(
        controllers[player] === 'computer' && picks.difficulty
          ? `Computer · ${DIFFICULTY_LABELS[difficulties[player]]}`
          : CONTROLLER_LABELS[controllers[player]],
      )
    }

    if (picks.random) {
      lines.push('Random')
    } else if (picks.town) {
      lines.push(picks.hero ? `${FACTIONS[factions[player]].name} · ${HEROES[heroes[player]].name}` : FACTIONS[factions[player]].name)
    }

    const army = picks.hero && !picks.random ? armies[player].filter((stack) => stack.count > 0) : []
    // A friend online makes their own picks; their card fills in as they choose.
    const remote = controllers[player] === 'remote'

    return (
      <button
        key={player}
        className={`panel side-summary side-summary--${player}`}
        disabled={remote}
        onClick={() => setDrawersOpen((current) => ({ ...current, [player]: true }))}
      >
        <span className="panel__title">{PLAYER_NAMES[player]} player</span>
        {lines.map((line) => (
          <span key={line} className="side-summary__line">
            {line}
          </span>
        ))}
        {!picks.hero && <span className="side-summary__cue">{remote ? 'Choosing…' : 'Assign team'}</span>}
        {picks.random && <span className="side-summary__secret">?</span>}
        {army.length > 0 && (
          <span className="side-summary__army">
            {army.map((stack) => (
              <span key={stack.type} className="side-summary__stack" title={`${stack.count} ${CREATURES[stack.type].plural}`}>
                <SpriteIcon spriteId={stack.type} owner={player} size={24} mirrored={player === 'blue'} />
                <span className="side-summary__count">{stack.count}</span>
              </span>
            ))}
          </span>
        )}
      </button>
    )
  }

  const sidePanel = (player: Player) =>
    drawersOpen[player] ? sideDrawer(player) : sideSummary(player)

  const sideDrawer = (player: Player) => (
    <section key={player} ref={drawers[player]} className={`panel army-picker__side army-picker__side--${player}`}>
      <h2 className="panel__title">{PLAYER_NAMES[player]} player</h2>
      {!online && playerStep(player)}
      {playerChosen(player) && randomStep(player)}
      {playerChosen(player) && townStep(player)}
      {playerChosen(player) && setup[player].town && !setup[player].random && heroStep(player)}
      {playerChosen(player) && setup[player].town && setup[player].hero && !setup[player].random && (
        <div className="setup-step">
          <ArmyBuilder
            player={player}
            faction={factions[player]}
            key={factions[player]}
            heroId={heroes[player]}
            army={armies[player]}
            size={armySizes[player]}
            onChange={(army) => onChangeArmy(player, army)}
            onChangeSize={(size) => onChangeArmySize(player, size)}
          />
        </div>
      )}
    </section>
  )

  return (
    <main className="start-screen">
      <header className="start-screen__header">
        <h1 className="start-screen__title">Banner &amp; Blade</h1>
      </header>

      {sidePanel('red')}

      <div className="start-screen__center">
        {/* Online, the host starts the battle once both sides are ready. */}
        <button
          className="button button--large battle-button"
          onClick={onStart}
          disabled={problems.length > 0 || !ready || (online !== null && !online.isHost)}
          autoFocus
        >
          {online && !online.isHost ? 'Waiting for host' : 'To battle!'}
        </button>
        {problems.length > 0 && <p className="start-screen__problem">{problems.join(' ')}</p>}
        <button className="button button--secondary start-screen__rules" onClick={() => setRulesOpen(true)}>
          How to play
        </button>
        {online ? (
          <button className="button button--secondary start-screen__rules" onClick={onLeaveOnline}>
            Leave online game
          </button>
        ) : (
          <button className="button button--secondary start-screen__rules" onClick={onOpenOnline}>
            Play online
          </button>
        )}
      </div>

      {sidePanel('blue')}

      {rulesOpen && (
        <Modal title="How to play" onClose={() => setRulesOpen(false)} className="rules">
          <HowToPlay />
        </Modal>
      )}

      {aboutOpen && (
        <Modal title="About" onClose={() => setAboutOpen(false)} className="about">
          <About />
        </Modal>
      )}

      <nav className="start-screen__corner" aria-label="More">
        <button className="button button--secondary" onClick={onOpenSettings}>
          Settings
        </button>
        <button className="button button--secondary" onClick={() => setAboutOpen(true)}>
          About
        </button>
        <GitHubLink />
      </nav>
    </main>
  )
}

interface ArmyBuilderProps {
  player: Player
  faction: Faction
  heroId: HeroId
  army: Army
  size: ArmySize
  onChange: (army: Army) => void
  onChangeSize: (size: ArmySize) => void
}

function ArmyBuilder({ player, faction, heroId, army, size, onChange, onChangeSize }: ArmyBuilderProps) {
  const hero = createHero(heroId)
  const budget = ARMY_BUDGETS[size]
  const goldLeft = budget - armyCost(army)
  /** Creatures marked for upgrading while the army has none of them yet. */
  const [pendingUpgrades, setPendingUpgrades] = useState<Set<BaseCreature>>(new Set())
  /** The version of a creature this row recruits: the one in the army, or the one chosen for when it joins. */
  const rowType = (base: BaseCreature) =>
    army.find((stack) => baseOf(stack.type) === base)?.type ?? (pendingUpgrades.has(base) ? UPGRADES[base] : base)
  const toggleUpgrade = (base: BaseCreature, upgraded: boolean) => {
    onChange(withUpgrade(army, faction, base, upgraded, budget))
    setPendingUpgrades((current) => {
      const next = new Set(current)

      if (upgraded) {
        next.add(base)
      } else {
        next.delete(base)
      }

      return next
    })
  }
  const countOf = (type: CreatureType) => army.find((stack) => stack.type === type)?.count ?? 0
  const setCount = (type: CreatureType, count: number) => {
    const allowed = Math.max(0, Math.min(Math.floor(count) || 0, mostAffordable(army, type, budget)))
    onChange(withStack(army, faction, type, allowed))
  }

  return (
    <div className="army-preview">
      {/* The hero's bonus and stats share one line, so the whole army fits without scrolling. */}
      <div className="army-preview__hero">
        <p className="army-preview__specialty">
          <span className="army-preview__specialty-label">Hero bonus:</span> {specialtyText(hero)}
        </p>
        <HeroStats hero={hero} showKnowledge />
      </div>
      <div className="recruit__gold">
        <span>
          <Icon name="gold" /> {formatGold(goldLeft)} <span className="recruit__budget">/ {formatGold(budget)} gold left</span>
        </span>
        <span className="recruit__presets">
          {/* The size sets the gold; Clear and Random keep it. */}
          {ARMY_SIZES.map((option) => (
            <button
              key={option}
              role="radio"
              aria-checked={option === size}
              className={`recruit__preset${option === size ? ' recruit__preset--active' : ''}`}
              onClick={() => onChangeSize(option)}
            >
              {ARMY_SIZE_LABELS[option]}
            </button>
          ))}
          <button
            className="recruit__preset"
            onClick={() => onChange(randomArmy(faction, createRandom(Math.floor(Math.random() * 2 ** 32)), budget))}
          >
            Random
          </button>
          <button className="recruit__preset" onClick={() => onChange([])}>
            Clear
          </button>
        </span>
      </div>
      <ul className="recruit">
        {FACTIONS[faction].creatures.map((base) => {
          const type = rowType(base)
          const upgraded = type !== base
          const other = upgraded ? base : UPGRADES[base]
          const stats = CREATURES[type]
          const count = countOf(type)
          const most = mostAffordable(army, type, budget)
          const specialist = hero.specialty.kind === 'creature' && hero.specialty.creature === base
          const upgradeTip = upgraded
            ? `Back to ${CREATURES[base].plural} (${CREATURES[base].cost} gold each)`
            : `Upgrade to ${CREATURES[other].plural} (${CREATURES[other].cost} gold each)\n${creatureSummary(other)}`

          return (
            <li
              key={base}
              className={`recruit__row${count === 0 ? ' recruit__row--empty' : ''}${specialist ? ' army-preview__specialist' : ''}`}
            >
              <SpriteIcon spriteId={type} owner={player} size={24} mirrored={player === 'blue'} />
              <span className="recruit__name" title={creatureSummary(type)}>
                {stats.plural}
                <span className="recruit__cost">{stats.cost} gold each</span>
              </span>
              <button
                className={`recruit__upgrade${upgraded ? ' recruit__upgrade--active' : ''}`}
                aria-pressed={upgraded}
                aria-label={`Upgrade ${CREATURES[base].plural} to ${CREATURES[UPGRADES[base]].plural}`}
                title={upgradeTip}
                onClick={() => toggleUpgrade(base, !upgraded)}
              >
                <Icon name="upgrade" />
              </button>
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
      <div>
        <h3 className="drawer-label">War machines</h3>
        <ul className="recruit" aria-label={`${PLAYER_NAMES[player]} war machines`}>
          {WAR_MACHINES.map((machine) => {
            const stats = CREATURES[machine]
            const count = countOf(machine)
            const most = mostAffordable(army, machine, budget)

            return (
              <li key={machine} className={`recruit__row${count === 0 ? ' recruit__row--empty' : ''}`}>
                <SpriteIcon spriteId={machine} owner={player} size={24} mirrored={player === 'blue'} />
                <span className="recruit__name" title={creatureSummary(machine)}>
                  {stats.name}
                  <span className="recruit__cost">{stats.cost} gold</span>
                </span>
                {/* War machines have no upgrade; the gap keeps their counters in line with the creatures'. */}
                <span className="recruit__upgrade-gap" />
                <span className="recruit__count">
                  <button
                    className="recruit__step"
                    aria-label={`No ${stats.name}`}
                    disabled={count === 0}
                    onClick={() => setCount(machine, 0)}
                  >
                    −
                  </button>
                  <input
                    className="recruit__input"
                    type="number"
                    min={0}
                    max={most}
                    value={count}
                    aria-label={`${PLAYER_NAMES[player]} ${stats.name}`}
                    onChange={(event) => setCount(machine, Number(event.target.value))}
                  />
                  <button
                    className="recruit__step"
                    aria-label={`Buy ${stats.name}`}
                    disabled={count >= most}
                    onClick={() => setCount(machine, 1)}
                  >
                    +
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
