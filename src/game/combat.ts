import { CREATURES, hasAbility, HATES } from './creatures'
import {
  BLESS_SPECIALTY_BONUS,
  HASTE_SPECIALTY_SPEED,
  isSpellSpecialist,
  SPECIALTY_ATTACK,
  SPECIALTY_DEFENSE,
  SPECIALTY_SPEED,
  type Hero,
} from './heroes'
import type { Random } from './random'
import type { EffectId } from './spells'
import type { Unit } from './types'

export const DEFEND_BONUS = 0.2
export const STONE_SKIN_DEFENSE = 3
export const HASTE_SPEED = 3
export const CHARGE_BONUS_PER_HEX = 0.05
export const MELEE_PENALTY = 0.5
export const DEATHBLOW_CHANCE = 0.2
export const PETRIFY_CHANCE = 0.2
export const CURSE_CHANCE = 0.2
export const CURSE_ROUNDS = 3
export const HATRED_BONUS = 0.5
/** Share of the target's defense that crushing blows ignore. */
export const CRUSHING_IGNORES = 0.4

export const hasEffect = (unit: Unit, effect: EffectId): boolean =>
  unit.effects.some((active) => active.effect === effect)

export function effectiveAttack(unit: Unit, hero: Hero): number {
  return CREATURES[unit.type].attack + hero.attack + (unit.specialty ? SPECIALTY_ATTACK : 0)
}

export function effectiveDefense(unit: Unit, hero: Hero): number {
  let defense = CREATURES[unit.type].defense + hero.defense + (unit.specialty ? SPECIALTY_DEFENSE : 0)
  if (hasEffect(unit, 'stoneSkin')) defense += STONE_SKIN_DEFENSE
  if (unit.defending) defense += Math.max(1, Math.round(defense * DEFEND_BONUS))
  return defense
}

export function effectiveSpeed(unit: Unit): number {
  let speed = CREATURES[unit.type].speed + (unit.specialty ? SPECIALTY_SPEED : 0)
  const haste = unit.effects.find((active) => active.effect === 'haste')
  if (haste) speed += HASTE_SPEED + (haste.boosted ? HASTE_SPECIALTY_SPEED : 0)
  if (hasEffect(unit, 'slow')) speed = Math.max(1, Math.floor(speed / 2))
  return speed
}

export const totalHp = (unit: Unit): number => (unit.count - 1) * CREATURES[unit.type].hp + unit.topHp

/** The stack after taking damage: how many are left, the top creature's HP and how many died. */
export function afterDamage(unit: Unit, damage: number): { count: number; topHp: number; kills: number } {
  const remaining = Math.max(0, totalHp(unit) - damage)
  if (remaining === 0) return { count: 0, topHp: 0, kills: unit.count }
  const creatureHp = CREATURES[unit.type].hp
  const count = Math.ceil(remaining / creatureHp)
  return { count, topHp: remaining - (count - 1) * creatureHp, kills: unit.count - count }
}

export interface StrikeOptions {
  /** A shot (as opposed to a melee blow). */
  ranged: boolean
  /** Hexes walked or flown before a melee attack, for the charge bonus. */
  hexesMoved: number
}

/** Every multiplier except luck and deathblow, which are rolled separately. */
export function damageMultiplier(
  attacker: Unit,
  attackerHero: Hero,
  target: Unit,
  targetHero: Hero,
  options: StrikeOptions,
): number {
  const attack = effectiveAttack(attacker, attackerHero)
  let defense = effectiveDefense(target, targetHero)
  if (hasAbility(attacker.type, 'crushing')) defense = Math.round(defense * (1 - CRUSHING_IGNORES))
  let multiplier =
    attack >= defense ? Math.min(4, 1 + 0.05 * (attack - defense)) : Math.max(0.3, 1 - 0.025 * (defense - attack))

  const stats = CREATURES[attacker.type]
  const isShooter = stats.shots > 0 || stats.range > 0
  if (!options.ranged && isShooter && !hasAbility(attacker.type, 'noMeleePenalty')) multiplier *= MELEE_PENALTY
  if (!options.ranged && hasAbility(attacker.type, 'charge') && !hasAbility(target.type, 'braced')) {
    multiplier *= 1 + CHARGE_BONUS_PER_HEX * options.hexesMoved
  }
  if (HATES[attacker.type] === target.type) multiplier *= 1 + HATRED_BONUS
  if (hasEffect(attacker, 'bless') && isSpellSpecialist(attackerHero, 'bless')) multiplier *= 1 + BLESS_SPECIALTY_BONUS
  return multiplier
}

function damagePerCreature(attacker: Unit): { minimum: number; maximum: number } {
  const stats = CREATURES[attacker.type]
  if (hasEffect(attacker, 'bless')) return { minimum: stats.maxDamage, maximum: stats.maxDamage }
  if (hasEffect(attacker, 'curse')) return { minimum: stats.minDamage, maximum: stats.minDamage }
  return { minimum: stats.minDamage, maximum: stats.maxDamage }
}

/** The lowest and highest damage a strike can do, before luck and deathblow. */
export function damageRange(
  attacker: Unit,
  attackerHero: Hero,
  target: Unit,
  targetHero: Hero,
  options: StrikeOptions,
): { minimum: number; maximum: number } {
  const multiplier = damageMultiplier(attacker, attackerHero, target, targetHero, options)
  const perCreature = damagePerCreature(attacker)
  return {
    minimum: Math.max(1, Math.floor(perCreature.minimum * attacker.count * multiplier)),
    maximum: Math.max(1, Math.floor(perCreature.maximum * attacker.count * multiplier)),
  }
}

export function rollDamage(
  attacker: Unit,
  attackerHero: Hero,
  target: Unit,
  targetHero: Hero,
  options: StrikeOptions & { canBeLucky: boolean },
  random: Random,
): { damage: number; lucky: boolean; deathblow: boolean } {
  const perCreature = damagePerCreature(attacker)
  // Roll for up to ten creatures and scale up, so big stacks stay quick.
  const rolls = Math.min(attacker.count, 10)
  let rolled = 0
  for (let roll = 0; roll < rolls; roll++) rolled += random.integer(perCreature.minimum, perCreature.maximum)
  const baseDamage = (rolled * attacker.count) / rolls

  let multiplier = damageMultiplier(attacker, attackerHero, target, targetHero, options)
  const lucky = options.canBeLucky && attackerHero.luck > 0 && random.chance(attackerHero.luck / 24)
  if (lucky) multiplier *= 2
  const deathblow = options.canBeLucky && hasAbility(attacker.type, 'deathblow') && random.chance(DEATHBLOW_CHANCE)
  if (deathblow) multiplier *= 2
  return { damage: Math.max(1, Math.floor(baseDamage * multiplier)), lucky, deathblow }
}
