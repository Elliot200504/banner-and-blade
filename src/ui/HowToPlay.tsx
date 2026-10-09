import type { ReactNode } from 'react'
import { ARMY_BUDGET } from '../game'
import { BattleDemo } from './BattleDemo'

function RulesCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="info-card">
      <h3 className="settings__heading info-card__heading">{title}</h3>
      {children}
    </section>
  )
}

/** The basics in short, shown from the start screen and from the settings. */
export function HowToPlay() {
  return (
    <div className="how-to-play">
      <BattleDemo />
      <div className="info-grid">
        <RulesCard title="Build your army">
          <p className="info-card__text">
            Pick a town and a hero, then spend {ARMY_BUDGET.toLocaleString('en-US')} gold on creatures. Then press To battle!
          </p>
        </RulesCard>
        <RulesCard title="Move">
          <p className="info-card__text">
            Click a shaded hex to move the active stack there. Fast stacks act first: the turn order bar shows who is next.
          </p>
        </RulesCard>
        <RulesCard title="Attack">
          <p className="info-card__text">
            Click an enemy to attack it, pointing at the side you want to strike from. Shooters fire from afar. Enemies hit up
            close strike back once per round.
          </p>
        </RulesCard>
        <RulesCard title="Wait, defend, cast">
          <p className="info-card__text">W: wait and act later this round.</p>
          <p className="info-card__text">D: defend for extra defense.</p>
          <p className="info-card__text">C: your hero casts a spell, once per round.</p>
        </RulesCard>
        <RulesCard title="Win">
          <p className="info-card__text">Destroy every enemy stack. Right-click any stack to see its stats.</p>
        </RulesCard>
      </div>
    </div>
  )
}
