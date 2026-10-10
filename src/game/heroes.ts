import type { CreatureType, Faction } from './creatures'
import { SPELL_ORDER, type SpellId } from './spells'

/** The heroes, after their namesakes in Heroes of Might and Magic III. */
export type HeroId =
  | 'tyris' | 'edric' | 'adela'
  | 'ivor' | 'ryland' | 'uland'
  | 'jabarkas' | 'shiva' | 'terek'
  | 'vokial' | 'septienna' | 'thant'
  | 'lorelei' | 'dace' | 'deemer'
  | 'fiona' | 'rashka' | 'xyron'
  | 'piquedram' | 'thane' | 'solmyr'
  | 'broghild' | 'wystan' | 'merist'
  | 'monere' | 'erdamon' | 'ciele'

/** What a hero is especially good at: one kind of creature, or one spell. */
export type Specialty = { kind: 'creature'; creature: CreatureType } | { kind: 'spell'; spell: SpellId }

export interface Hero {
  id: HeroId
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
  specialty: Specialty
  /** Every spell in the hero's spellbook. */
  spells: SpellId[]
}

interface HeroTemplate extends Omit<Hero, 'id' | 'mana' | 'maxMana' | 'hasCastThisRound' | 'spells'> {
  faction: Faction
  /** Spells only this hero knows, on top of the common spellbook. */
  extraSpells: SpellId[]
}

type ClassStats = Pick<Hero, 'title' | 'attack' | 'defense' | 'spellPower' | 'knowledge' | 'morale' | 'luck'>

// Starting stats lean the way each HoMM3 class does: might classes fight, magic classes cast.
const KNIGHT: ClassStats = { title: 'Knight', attack: 2, defense: 2, spellPower: 1, knowledge: 2, morale: 1, luck: 1 }
const CLERIC: ClassStats = { title: 'Cleric', attack: 1, defense: 0, spellPower: 2, knowledge: 3, morale: 1, luck: 1 }
const DEATH_KNIGHT: ClassStats = { title: 'Death Knight', attack: 3, defense: 3, spellPower: 1, knowledge: 2, morale: 0, luck: 1 }
const NECROMANCER: ClassStats = { title: 'Necromancer', attack: 1, defense: 0, spellPower: 3, knowledge: 3, morale: 0, luck: 1 }
const OVERLORD: ClassStats = { title: 'Overlord', attack: 2, defense: 2, spellPower: 1, knowledge: 2, morale: 1, luck: 1 }
const WARLOCK: ClassStats = { title: 'Warlock', attack: 0, defense: 0, spellPower: 3, knowledge: 3, morale: 0, luck: 1 }
const RANGER: ClassStats = { title: 'Ranger', attack: 1, defense: 3, spellPower: 1, knowledge: 2, morale: 1, luck: 2 }
const DRUID: ClassStats = { title: 'Druid', attack: 0, defense: 2, spellPower: 2, knowledge: 3, morale: 1, luck: 2 }
const BARBARIAN: ClassStats = { title: 'Barbarian', attack: 4, defense: 0, spellPower: 1, knowledge: 1, morale: 1, luck: 1 }
const BATTLE_MAGE: ClassStats = { title: 'Battle Mage', attack: 2, defense: 1, spellPower: 2, knowledge: 2, morale: 1, luck: 1 }
const DEMONIAC: ClassStats = { title: 'Demoniac', attack: 2, defense: 2, spellPower: 1, knowledge: 2, morale: 1, luck: 1 }
const HERETIC: ClassStats = { title: 'Heretic', attack: 1, defense: 1, spellPower: 2, knowledge: 3, morale: 1, luck: 1 }
const ALCHEMIST: ClassStats = { title: 'Alchemist', attack: 1, defense: 1, spellPower: 2, knowledge: 2, morale: 1, luck: 1 }
const WIZARD: ClassStats = { title: 'Wizard', attack: 0, defense: 0, spellPower: 2, knowledge: 3, morale: 1, luck: 1 }
const BEASTMASTER: ClassStats = { title: 'Beastmaster', attack: 0, defense: 4, spellPower: 1, knowledge: 1, morale: 1, luck: 1 }
const WITCH: ClassStats = { title: 'Witch', attack: 0, defense: 1, spellPower: 2, knowledge: 2, morale: 1, luck: 1 }
const PLANESWALKER: ClassStats = { title: 'Planeswalker', attack: 3, defense: 1, spellPower: 1, knowledge: 1, morale: 1, luck: 1 }
const ELEMENTALIST: ClassStats = { title: 'Elementalist', attack: 0, defense: 0, spellPower: 3, knowledge: 3, morale: 1, luck: 1 }

const creature = (type: CreatureType): Specialty => ({ kind: 'creature', creature: type })
const spell = (id: SpellId): Specialty => ({ kind: 'spell', spell: id })

export const HEROES: Record<HeroId, HeroTemplate> = {
  tyris: { name: 'Tyris', ...KNIGHT, faction: 'castle', specialty: creature('cavalier'), extraSpells: [] },
  edric: { name: 'Edric', ...KNIGHT, faction: 'castle', specialty: creature('griffin'), extraSpells: [] },
  adela: { name: 'Adela', ...CLERIC, faction: 'castle', specialty: spell('bless'), extraSpells: [] },
  ivor: { name: 'Ivor', ...RANGER, faction: 'rampart', specialty: creature('woodElf'), extraSpells: [] },
  ryland: { name: 'Ryland', ...RANGER, faction: 'rampart', specialty: creature('dendroidGuard'), extraSpells: [] },
  uland: { name: 'Uland', ...DRUID, faction: 'rampart', specialty: spell('cure'), extraSpells: [] },
  jabarkas: { name: 'Jabarkas', ...BARBARIAN, faction: 'stronghold', specialty: creature('orc'), extraSpells: [] },
  shiva: { name: 'Shiva', ...BARBARIAN, faction: 'stronghold', specialty: creature('roc'), extraSpells: [] },
  terek: { name: 'Terek', ...BATTLE_MAGE, faction: 'stronghold', specialty: spell('haste'), extraSpells: [] },
  vokial: { name: 'Vokial', ...DEATH_KNIGHT, faction: 'necropolis', specialty: creature('vampire'), extraSpells: [] },
  septienna: {
    name: 'Septienna', ...NECROMANCER, faction: 'necropolis', specialty: spell('deathRipple'), extraSpells: ['deathRipple'],
  },
  thant: { name: 'Thant', ...NECROMANCER, faction: 'necropolis', specialty: spell('animateDead'), extraSpells: ['animateDead'] },
  lorelei: { name: 'Lorelei', ...OVERLORD, faction: 'dungeon', specialty: creature('harpy'), extraSpells: [] },
  dace: { name: 'Dace', ...OVERLORD, faction: 'dungeon', specialty: creature('minotaur'), extraSpells: [] },
  deemer: { name: 'Deemer', ...WARLOCK, faction: 'dungeon', specialty: spell('meteorShower'), extraSpells: ['meteorShower'] },
  fiona: { name: 'Fiona', ...DEMONIAC, faction: 'inferno', specialty: creature('hellHound'), extraSpells: [] },
  rashka: { name: 'Rashka', ...DEMONIAC, faction: 'inferno', specialty: creature('efreet'), extraSpells: [] },
  xyron: { name: 'Xyron', ...HERETIC, faction: 'inferno', specialty: spell('inferno'), extraSpells: ['inferno'] },
  piquedram: { name: 'Piquedram', ...ALCHEMIST, faction: 'tower', specialty: creature('stoneGargoyle'), extraSpells: [] },
  thane: { name: 'Thane', ...ALCHEMIST, faction: 'tower', specialty: creature('genie'), extraSpells: [] },
  solmyr: { name: 'Solmyr', ...WIZARD, faction: 'tower', specialty: spell('lightningBolt'), extraSpells: [] },
  broghild: { name: 'Broghild', ...BEASTMASTER, faction: 'fortress', specialty: creature('wyvern'), extraSpells: [] },
  wystan: { name: 'Wystan', ...BEASTMASTER, faction: 'fortress', specialty: creature('lizardman'), extraSpells: [] },
  merist: { name: 'Merist', ...WITCH, faction: 'fortress', specialty: spell('stoneSkin'), extraSpells: [] },
  monere: { name: 'Monere', ...PLANESWALKER, faction: 'conflux', specialty: creature('psychicElemental'), extraSpells: [] },
  erdamon: { name: 'Erdamon', ...PLANESWALKER, faction: 'conflux', specialty: creature('earthElemental'), extraSpells: [] },
  ciele: { name: 'Ciele', ...ELEMENTALIST, faction: 'conflux', specialty: spell('magicArrow'), extraSpells: [] },
}

export const HERO_ORDER: HeroId[] = [
  'tyris', 'edric', 'adela',
  'ivor', 'ryland', 'uland',
  'jabarkas', 'shiva', 'terek',
  'vokial', 'septienna', 'thant',
  'lorelei', 'dace', 'deemer',
  'fiona', 'rashka', 'xyron',
  'piquedram', 'thane', 'solmyr',
  'broghild', 'wystan', 'merist',
  'monere', 'erdamon', 'ciele',
]

export const heroesOf = (faction: Faction): HeroId[] => HERO_ORDER.filter((id) => HEROES[id].faction === faction)

/** Creature specialists give their creatures this much extra attack and defense, and one more speed. */
export const SPECIALTY_ATTACK = 2
export const SPECIALTY_DEFENSE = 2
export const SPECIALTY_SPEED = 1
/** A spell specialist's own spell hits (or heals) this much harder. */
export const SPELL_SPECIALTY_BONUS = 1.5
/**
 * Spells whose specialists get a different bonus. Death Ripple already hits the whole field, so its specialist's
 * edge is hitting enemy undead too, with no extra damage. Animate Dead heals just one stack, so it heals double.
 */
const SPELL_SPECIALTY_BONUSES: Partial<Record<SpellId, number>> = { deathRipple: 1, animateDead: 2 }

export const spellSpecialtyBonus = (spell: SpellId): number => SPELL_SPECIALTY_BONUSES[spell] ?? SPELL_SPECIALTY_BONUS
/** Extra damage for stacks blessed by a Bless specialist. */
export const BLESS_SPECIALTY_BONUS = 0.2
/** Extra speed for stacks hasted by a Haste specialist. */
export const HASTE_SPECIALTY_SPEED = 2
/** Extra defense for stacks protected by a Stone Skin specialist. */
export const STONE_SKIN_SPECIALTY_DEFENSE = 3

export const isSpellSpecialist = (hero: Pick<Hero, 'specialty'>, id: SpellId): boolean =>
  hero.specialty.kind === 'spell' && hero.specialty.spell === id

export function createHero(id: HeroId): Hero {
  const { faction: _faction, extraSpells, ...template } = HEROES[id]
  const maxMana = template.knowledge * 10

  return { ...template, id, mana: maxMana, maxMana, hasCastThisRound: false, spells: [...SPELL_ORDER, ...extraSpells] }
}
