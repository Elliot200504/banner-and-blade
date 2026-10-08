import type { Faction } from './creatures'

export interface Hero {
  name: string
  title: string
  attack: number
  defense: number
  spellPower: number
  knowledge: number
  mana: number
  maxMana: number
  /** Each point is a 1 in 24 chance of an extra turn. */
  morale: number
  /** Each point is a 1 in 24 chance of double damage. */
  luck: number
  hasCastThisRound: boolean
}

const HERO_TEMPLATES: Record<Faction, Omit<Hero, 'mana' | 'maxMana' | 'hasCastThisRound'>> = {
  order: { name: 'Sir Aldric', title: 'Knight-Commander', attack: 2, defense: 2, spellPower: 2, knowledge: 2, morale: 2, luck: 1 },
  undead: { name: 'Morwen the Pale', title: 'Necromancer', attack: 1, defense: 2, spellPower: 3, knowledge: 3, morale: 0, luck: 1 },
}

export function createHero(faction: Faction): Hero {
  const template = HERO_TEMPLATES[faction]
  const maxMana = template.knowledge * 10
  return { ...template, mana: maxMana, maxMana, hasCastThisRound: false }
}
