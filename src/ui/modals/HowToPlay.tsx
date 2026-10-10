import { useState, type ReactNode } from 'react'
import { BattleDemo, type DemoId } from '../board/BattleDemo'

interface RulesCardProps {
  title: string
  /** The demo this topic plays on the board above, if it has one. */
  demo?: DemoId
  playing: DemoId
  onPlay: (demo: DemoId) => void
  children: ReactNode
}

function RulesCard({ title, demo, playing, onPlay, children }: RulesCardProps) {
  return (
    <section className={`info-card${demo === playing ? ' info-card--playing' : ''}`}>
      <h3 className="settings__heading info-card__heading">
        {title}
        {demo && (
          <button className="info-card__demo" aria-pressed={demo === playing} onClick={() => onPlay(demo)}>
            Demo
          </button>
        )}
      </h3>
      {children}
    </section>
  )
}

/** The basics in short, shown from the start screen and from the settings. Each topic can be shown on the board. */
export function HowToPlay() {
  const [playing, setPlaying] = useState<DemoId>('tour')
  const card = { playing, onPlay: setPlaying }

  return (
    <div className="how-to-play">
      <BattleDemo demo={playing} />
      <div className="info-grid">
        <RulesCard title="Build your army" {...card}>
          <p className="info-card__text">
            Pick a town, a hero and an army size: Small, Medium or Large sets your gold. Then press To battle!
          </p>
        </RulesCard>
        <RulesCard title="Move" demo="move" {...card}>
          <p className="info-card__text">
            Click a shaded hex to move the active stack there. Fast stacks act first: the turn order bar shows who is next.
          </p>
        </RulesCard>
        <RulesCard title="Attack" demo="attack" {...card}>
          <p className="info-card__text">
            Click an enemy to attack it, pointing at the side you want to strike from. Shooters fire from afar. Enemies hit up
            close strike back once per round.
          </p>
        </RulesCard>
        <RulesCard title="Wait and defend" demo="actions" {...card}>
          <p className="info-card__text">W: wait and act later this round.</p>
          <p className="info-card__text">D: defend for extra defense.</p>
        </RulesCard>
        <RulesCard title="Spellbook" demo="spellbook" {...card}>
          <p className="info-card__text">
            C or the Spellbook button: your hero casts one spell per round, and it does not end the stack&apos;s turn.
          </p>
        </RulesCard>
        <RulesCard title="Win" demo="win" {...card}>
          <p className="info-card__text">Destroy every enemy stack. Right-click any stack to see its stats.</p>
        </RulesCard>
      </div>
    </div>
  )
}
