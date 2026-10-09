import type { Hero } from '../game'
import { Icon } from './SpriteImage'

/** What each hero stat does, shown when hovering it. */
export const HERO_STAT_TIPS = {
  attack: "Attack: added to every stack's attack. Each point of attack above the target's defense adds 5% damage.",
  defense: "Defense: added to every stack's defense. Each point of defense above the attacker's attack takes 2.5% off the damage.",
  spellPower: 'Spell power: spells hit and heal harder, and Haste, Slow, Bless, Curse and Stone Skin last one round per point.',
  knowledge: 'Knowledge: 10 mana per point, to cast spells with.',
  morale: 'Morale: each point is a 1 in 24 chance that a stack acts again right after its turn. The undead have no morale.',
  luck: 'Luck: each point is a 1 in 24 chance that a strike deals double damage.',
}

const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`)

/** The hero's stats as icons, each explained in a tooltip. */
export function HeroStats({ hero, showKnowledge = false }: { hero: Hero; showKnowledge?: boolean }) {
  return (
    <div className="hero-stats">
      <span title={HERO_STAT_TIPS.attack}>
        <Icon name="attack" label="Attack" /> {hero.attack}
      </span>
      <span title={HERO_STAT_TIPS.defense}>
        <Icon name="defense" label="Defense" /> {hero.defense}
      </span>
      <span title={HERO_STAT_TIPS.spellPower}>
        <Icon name="spellPower" label="Spell power" /> {hero.spellPower}
      </span>
      {showKnowledge && (
        <span title={HERO_STAT_TIPS.knowledge}>
          <Icon name="spellbook" label="Knowledge" /> {hero.knowledge}
        </span>
      )}
      <span title={HERO_STAT_TIPS.morale}>
        <Icon name="morale" label="Morale" /> {signed(hero.morale)}
      </span>
      <span title={HERO_STAT_TIPS.luck}>
        <Icon name="luck" label="Luck" /> {signed(hero.luck)}
      </span>
    </div>
  )
}
