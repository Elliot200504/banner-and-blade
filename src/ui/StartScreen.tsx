import { createHero, CREATURES, FACTIONS, PLAYER_NAMES, type Faction, type Player } from '../game'
import { SpriteIcon } from './SpriteImage'

interface StartScreenProps {
  factions: Record<Player, Faction>
  onChangeFaction: (player: Player, faction: Faction) => void
  onStart: () => void
}

const FACTION_LIST: Faction[] = ['order', 'undead']

export function StartScreen({ factions, onChangeFaction, onStart }: StartScreenProps) {
  return (
    <main className="start-screen">
      <div className="start-screen__crest">⚔️</div>
      <h1 className="start-screen__title">Banner &amp; Blade</h1>
      <p className="start-screen__subtitle">Hot-seat hex battles · two players, one computer</p>

      <div className="army-picker">
        {(['red', 'blue'] as const).map((player) => (
          <section key={player} className={`panel army-picker__side army-picker__side--${player}`}>
            <h2 className="panel__title">{PLAYER_NAMES[player]} player</h2>
            <div className="army-picker__factions" role="radiogroup" aria-label={`${PLAYER_NAMES[player]} faction`}>
              {FACTION_LIST.map((faction) => (
                <button
                  key={faction}
                  role="radio"
                  aria-checked={factions[player] === faction}
                  className={`faction-option${factions[player] === faction ? ' faction-option--active' : ''}`}
                  onClick={() => onChangeFaction(player, faction)}
                >
                  {faction === 'order' ? '🛡️' : '💀'} {FACTIONS[faction].name}
                </button>
              ))}
            </div>
            <ArmyPreview player={player} faction={factions[player]} />
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
          <li>Enemies hit in melee strike back once per round (Gryphons twice; nobody strikes back at Vampires).</li>
          <li>📖 C: your hero casts one spell per round without ending the turn.</li>
          <li>⏳ W: wait and act later this round. 🛡️ D: defend for extra defense.</li>
          <li>Good morale may grant an extra turn; luck may double damage.</li>
          <li>Right-click any stack to see its full stats. Destroy every enemy stack to win.</li>
        </ul>
      </section>
    </main>
  )
}

function ArmyPreview({ player, faction }: { player: Player; faction: Faction }) {
  const hero = createHero(faction)
  return (
    <div className="army-preview">
      <p className="army-preview__description">{FACTIONS[faction].description}</p>
      <p className="army-preview__hero">
        Hero: {hero.name}, {hero.title}
      </p>
      <ul className="army-preview__units">
        {FACTIONS[faction].creatures.map((type) => (
          <li key={type} title={CREATURES[type].plural}>
            <SpriteIcon spriteId={type} owner={player} size={40} mirrored={player === 'blue'} />
            <span>{CREATURES[type].armyCount}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
