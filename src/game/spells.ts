export type SpellId = 'magicArrow' | 'lightningBolt' | 'haste' | 'slow' | 'bless' | 'curse' | 'stoneSkin' | 'cure'

/** Spells that stay on a stack for a number of rounds. */
export type EffectId = 'haste' | 'slow' | 'bless' | 'curse' | 'stoneSkin'

export interface SpellDefinition {
  name: string
  icon: string
  cost: number
  target: 'enemy' | 'ally'
  description: string
}

export const SPELLS: Record<SpellId, SpellDefinition> = {
  magicArrow: { name: 'Magic Arrow', icon: '✨', cost: 5, target: 'enemy', description: 'Deals 10 + 10 × power damage.' },
  lightningBolt: { name: 'Lightning Bolt', icon: '⚡', cost: 10, target: 'enemy', description: 'Deals 10 + 25 × power damage.' },
  haste: { name: 'Haste', icon: '💨', cost: 6, target: 'ally', description: '+3 speed for power rounds.' },
  slow: { name: 'Slow', icon: '🐌', cost: 6, target: 'enemy', description: 'Halves speed for power rounds.' },
  bless: { name: 'Bless', icon: '🌟', cost: 5, target: 'ally', description: 'Always deals maximum damge.' },
  curse: { name: 'Curse', icon: '💀', cost: 5, target: 'enemy', description: 'Always deals minimum damage.' },
  stoneSkin: { name: 'Stone Skin', icon: '🪨', cost: 5, target: 'ally', description: '+3 defense for power rounds.' },
  cure: { name: 'Cure', icon: '💚', cost: 6, target: 'ally', description: 'Heals 10 + 5 × power and removes Slow and Curse.' },
}

export const SPELL_ORDER: SpellId[] = ['magicArrow', 'lightningBolt', 'haste', 'slow', 'bless', 'curse', 'stoneSkin', 'cure']

/** Each effect cancels its opposite. */
export const OPPOSITE_EFFECT: Partial<Record<EffectId, EffectId>> = {
  haste: 'slow',
  slow: 'haste',
  bless: 'curse',
  curse: 'bless',
}

export function spellDamage(spell: SpellId, spellPower: number): number {
  if (spell === 'magicArrow') return 10 + 10 * spellPower
  if (spell === 'lightningBolt') return 10 + 25 * spellPower
  return 0
}

export const cureAmount = (spellPower: number): number => 10 + 5 * spellPower

export const isEffect = (spell: SpellId): spell is EffectId =>
  spell === 'haste' || spell === 'slow' || spell === 'bless' || spell === 'curse' || spell === 'stoneSkin'
