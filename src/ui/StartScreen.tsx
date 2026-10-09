import { createHero, CREATURES, FACTIONS, HEROES, heroesOf, PLAYER_NAMES, type Faction, type HeroId, type Player } from '../game'
import { specialtyText } from './heroText'
import { SpriteIcon } from './SpriteImage'

/** Who plays a side: someone at the keyboard, or the computer. */
export type Controller = 'human' | 'computer'

const CONTROLLER_LABELS: Record<Controller, string> = { human: '🧑 Human', computer: '🤖 Computer' }

interface StartScreenProps {
  factions: Record<Player, Faction>
  controllers: Record<Player, Controller>
  heroes: Record<Player, HeroId>
  onChangeFaction: (player: Player, faction: Faction) => void
  onChangeController: (player: Player, controller: Controller) => void
  onChangeHero: (player: Player, hero: HeroId) => void
  onStart: () => void
}

const FACTION_LIST: Faction[] = ['order', 'undead', 'dungeon']

export function StartScreen({
  factions,
  controllers,
  heroes,
  onChangeFaction,
  onChangeController,
  onChangeHero,
  onStart,
}: StartScreenProps) {
  return (
    <main className="start-screen">
      <div className="start-screen__crest">⚔️</div>
      <h1 className="start-screen__title">Banner &amp; Blade</h1>
      <p className="start-screen__subtitle">Hex battles · play the computer or a friend on the same screen</p>

      <div className="army-picker">
        {(['red', 'blue'] as const).map((player) => (
          <section key={player} className={`panel army-picker__side army-picker__side--${player}`}>
            <h2 className="panel__title">{PLAYER_NAMES[player]} player</h2>
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
            <div className="army-picker__factions" role="radiogroup" aria-label={`${PLAYER_NAMES[player]} faction`}>
              {FACTION_LIST.map((faction) => (
                <button
                  key={faction}
                  role="radio"
                  aria-checked={factions[player] === faction}
                  className={`faction-option${factions[player] === faction ? ' faction-option--active' : ''}`}
                  onClick={() => onChangeFaction(player, faction)}
                >
                  {FACTIONS[faction].crest} {FACTIONS[faction].name}
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
                  <SpriteIcon spriteId={id} owner={player} size={40} />
                  <span className="hero-option__name">{HEROES[id].name}</span>
                  <span className="hero-option__class">{HEROES[id].title}</span>
                </button>
              ))}
            </div>
            <ArmyPreview player={player} faction={factions[player]} heroId={heroes[player]} />
          </section>
        ))}
      </div>

      <button className="button button--large" onClick={onStart} autoFocus>
        To battle!
      </button>

      <section className="panel start-screen__rules">
        <h2 className="panel__title">How to play</h2>
        <ul>
          <li>Stacks act in order of speed. Watch the turn order bar to see who goes next.</li>
          <li>Click a shaded hex to move. Click an enemy to attack; aim at the side you want to strike from.</li>
          <li>Shooters have limited range and shots. With an enemy next to them they must fight in melee at half damage.</li>
          <li>Enemies hit in melee strike back once per round (Gryphons and Minotaurs twice; nobody strikes back at Vampires).</li>
          <li>Medusas can turn a stack to stone: it loses its next turn and cannot strike back until then.</li>
          <li>📖 C: your hero casts one spell per round without ending the turn.</li>
          <li>⏳ W: wait and act later this round. 🛡️ D: defend for extra defense.</li>
          <li>Each hero has a specialty: a creature they lead better, or a spell they cast harder.</li>
          <li>Good morale may grant an extra turn; luck may double damage.</li>
          <li>Right-click any stack to see its full stats. Destroy every enemy stack to win.</li>
        </ul>
      </section>
    </main>
  )
}

function ArmyPreview({ player, faction, heroId }: { player: Player; faction: Faction; heroId: HeroId }) {
  const hero = createHero(heroId)
  return (
    <div className="army-preview">
      <p className="army-preview__description">{FACTIONS[faction].description}</p>
      <p className="army-preview__hero">
        Hero: {hero.name}, {hero.title}
      </p>
      <p className="army-preview__specialty">★ {specialtyText(hero)}</p>
      <ul className="army-preview__units">
        {FACTIONS[faction].creatures.map((type) => (
          <li
            key={type}
            title={CREATURES[type].plural}
            className={hero.specialty.kind === 'creature' && hero.specialty.creature === type ? 'army-preview__specialist' : undefined}
          >
            <SpriteIcon spriteId={type} owner={player} size={40} mirrored={player === 'blue'} />
            <span>{CREATURES[type].armyCount}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
