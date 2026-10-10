import {
  BLESS_SPECIALTY_BONUS,
  CREATURES,
  HASTE_SPECIALTY_SPEED,
  SPECIALTY_ATTACK,
  SPECIALTY_DEFENSE,
  SPECIALTY_SPEED,
  spellSpecialtyBonus,
  SPELLS,
  STONE_SKIN_SPECIALTY_DEFENSE,
  type Hero,
} from '../../game'

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

  if (specialty.spell === 'stoneSkin') {
    return `${name}: protected stacks get +${STONE_SKIN_SPECIALTY_DEFENSE} more defense`
  }

  if (specialty.spell === 'deathRipple') {
    return `${name}: also hits enemy undead`
  }

  const what = specialty.spell === 'animateDead' || specialty.spell === 'cure' ? 'healing' : 'damage'

  return `${name}: ${percent(spellSpecialtyBonus(specialty.spell) - 1)} ${what}`
}
