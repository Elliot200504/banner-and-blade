import { isSpellSpecialist, SPELL_SPECIALTY_BONUS, type Hero } from './heroes'

export type SpellId =
  | 'magicArrow'
  | 'lightningBolt'
  | 'haste'
  | 'slow'
  | 'bless'
  | 'curse'
  | 'stoneSkin'
  | 'cure'
  | 'deathRipple'
  | 'animateDead'
  | 'meteorShower'

/** Spells that stay on a stack for a number of rounds. */
export type EffectId = 'haste' | 'slow' | 'bless' | 'curse' | 'stoneSkin'

export interface SpellDefinition {
  name: string
  icon: string
  cost: number
  /** Who it can be cast on. 'everyone' spells need no target and hit the whole field. */
  target: 'enemy' | 'ally' | 'everyone'
  /** Only works on undead stacks. */
  undeadOnly?: boolean
  description: string
}

export const SPELLS: Record<SpellId, SpellDefinition> = {
  magicArrow: { name: 'Magic Arrow', icon: '✨', cost: 5, target: 'enemy', description: 'Deals 10 + 10 × power damage.' },
  lightningBolt: { name: 'Lightning Bolt', icon: '⚡', cost: 10, target: 'enemy', description: 'Deals 10 + 25 × power damage.' },
  haste: { name: 'Haste', icon: '💨', cost: 6, target: 'ally', description: '+3 speed for power rounds.' },
  slow: { name: 'Slow', icon: '🐌', cost: 6, target: 'enemy', description: 'Halves speed for power rounds.' },
  bless: { name: 'Bless', icon: '🌟', cost: 5, target: 'ally', description: 'Always deals maximum damage.' },
  curse: { name: 'Curse', icon: '💀', cost: 5, target: 'enemy', description: 'Always deals minimum damage.' },
  stoneSkin: { name: 'Stone Skin', icon: '🪨', cost: 5, target: 'ally', description: '+3 defense for power rounds.' },
  cure: { name: 'Cure', icon: '💚', cost: 6, target: 'ally', description: 'Heals 10 + 5 × power and removes Slow, Curse and Petrify.' },
  deathRipple: {
    name: 'Death Ripple', icon: '🌀', cost: 10, target: 'everyone',
    description: 'Deals 10 + 5 × power damage to every living stack, friend or foe.',
  },
  animateDead: {
    name: 'Animate Dead', icon: '🦴', cost: 10, target: 'ally', undeadOnly: true,
    description: 'Restores 30 + 20 × power health to an undead stack, raising its fallen.',
  },
  meteorShower: {
    name: 'Meteor Shower', icon: '☄️', cost: 12, target: 'enemy',
    description: 'Deals 10 + 15 × power damage to the target and every stack next to it.',
  },
}

export const SPELL_ORDER: SpellId[] = ['magicArrow', 'lightningBolt', 'haste', 'slow', 'bless', 'curse', 'stoneSkin', 'cure']

/** Each effect cancels its opposite. */
export const OPPOSITE_EFFECT: Partial<Record<EffectId, EffectId>> = {
  haste: 'slow',
  slow: 'haste',
  bless: 'curse',
  curse: 'bless',
}

/** The specialist's bonus, if the hero specialises in this spell. */
const specialtyFactor = (spell: SpellId, hero: Pick<Hero, 'specialty'>) =>
  isSpellSpecialist(hero, spell) ? SPELL_SPECIALTY_BONUS : 1

function baseDamage(spell: SpellId, power: number): number {
  if (spell === 'magicArrow') return 10 + 10 * power
  if (spell === 'lightningBolt') return 10 + 25 * power
  if (spell === 'deathRipple') return 10 + 5 * power
  if (spell === 'meteorShower') return 10 + 15 * power
  return 0
}

export function spellDamage(spell: SpellId, hero: Pick<Hero, 'spellPower' | 'specialty'>): number {
  return Math.floor(baseDamage(spell, hero.spellPower) * specialtyFactor(spell, hero))
}

export const cureAmount = (spellPower: number): number => 10 + 5 * spellPower

export const animateDeadAmount = (hero: Pick<Hero, 'spellPower' | 'specialty'>): number =>
  Math.floor((30 + 20 * hero.spellPower) * specialtyFactor('animateDead', hero))

export const isEffect = (spell: SpellId): spell is EffectId =>
  spell === 'haste' || spell === 'slow' || spell === 'bless' || spell === 'curse' || spell === 'stoneSkin'
