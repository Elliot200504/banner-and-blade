import {
  BLESS_SPECIALTY_BONUS,
  CREATURES,
  HASTE_SPECIALTY_SPEED,
  SPECIALTY_ATTACK,
  SPECIALTY_DEFENSE,
  SPECIALTY_SPEED,
  SPELL_SPECIALTY_BONUS,
  SPELLS,
  type Hero,
} from '../game'

const percent = (bonus: number) => `+${Math.round(bonus * 100)}%`

/** One line describing what the hero is especially good at. */
export function specialtyText(hero: Pick<Hero, 'specialty'>): string {
  const { specialty } = hero

  if (specialty.kind === 'creature') {
    return `${CREATURES[specialty.creature].plural}: +${SPECIALTY_ATTACK} attack, +${SPECIALTY_DEFENSE} defense, +${SPECIALTY_SPEED} speed`
  }

  const name = SPELLS[specialty.spell].name

  if (specialty.spell === 'bless') {
    return `${name}: blessed stacks deal ${percent(BLESS_SPECIALTY_BONUS)} damage`
  }

  if (specialty.spell === 'haste') {
    return `${name}: hasted stacks get +${HASTE_SPECIALTY_SPEED} more speed`
  }

  if (specialty.spell === 'deathRipple') {
    return `${name}: ${percent(SPELL_SPECIALTY_BONUS - 1)} damage, and it hurts enemy undead too`
  }

  const what = specialty.spell === 'animateDead' || specialty.spell === 'cure' ? 'healing' : 'damage'

  return `${name}: ${percent(SPELL_SPECIALTY_BONUS - 1)} ${what}`
}
