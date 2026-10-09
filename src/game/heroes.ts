import type { CreatureType, Faction } from './creatures'
import { SPELL_ORDER, type SpellId } from './spells'

/** The heroes, after their namesakes in Heroes of Might and Magic III. */
export type HeroId = 'tyris' | 'edric' | 'adela' | 'vokial' | 'septienna' | 'thant' | 'lorelei' | 'dace' | 'deemer'

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
const DEATH_KNIGHT: ClassStats = { title: 'Death Knight', attack: 1, defense: 2, spellPower: 2, knowledge: 2, morale: 0, luck: 1 }
const NECROMANCER: ClassStats = { title: 'Necromancer', attack: 1, defense: 0, spellPower: 3, knowledge: 3, morale: 0, luck: 1 }
const OVERLORD: ClassStats = { title: 'Overlord', attack: 2, defense: 2, spellPower: 1, knowledge: 2, morale: 1, luck: 1 }
const WARLOCK: ClassStats = { title: 'Warlock', attack: 0, defense: 0, spellPower: 3, knowledge: 3, morale: 0, luck: 1 }

const creature = (type: CreatureType): Specialty => ({ kind: 'creature', creature: type })
const spell = (id: SpellId): Specialty => ({ kind: 'spell', spell: id })

export const HEROES: Record<HeroId, HeroTemplate> = {
  tyris: { name: 'Tyris', ...KNIGHT, faction: 'order', specialty: creature('knight'), extraSpells: [] },
  edric: { name: 'Edric', ...KNIGHT, faction: 'order', specialty: creature('gryphon'), extraSpells: [] },
  adela: { name: 'Adela', ...CLERIC, faction: 'order', specialty: spell('bless'), extraSpells: [] },
  vokial: { name: 'Vokial', ...DEATH_KNIGHT, faction: 'undead', specialty: creature('vampire'), extraSpells: [] },
  septienna: {
    name: 'Septienna', ...NECROMANCER, faction: 'undead', specialty: spell('deathRipple'), extraSpells: ['deathRipple'],
  },
  thant: { name: 'Thant', ...NECROMANCER, faction: 'undead', specialty: spell('animateDead'), extraSpells: ['animateDead'] },
  lorelei: { name: 'Lorelei', ...OVERLORD, faction: 'dungeon', specialty: creature('harpy'), extraSpells: [] },
  dace: { name: 'Dace', ...OVERLORD, faction: 'dungeon', specialty: creature('minotaur'), extraSpells: [] },
  deemer: { name: 'Deemer', ...WARLOCK, faction: 'dungeon', specialty: spell('meteorShower'), extraSpells: ['meteorShower'] },
}

export const HERO_ORDER: HeroId[] = ['tyris', 'edric', 'adela', 'vokial', 'septienna', 'thant', 'lorelei', 'dace', 'deemer']

export const heroesOf = (faction: Faction): HeroId[] => HERO_ORDER.filter((id) => HEROES[id].faction === faction)

/** Creature specialists give their creatures this much extra attack and defense, and one more speed. */
export const SPECIALTY_ATTACK = 2
export const SPECIALTY_DEFENSE = 2
export const SPECIALTY_SPEED = 1
/** A spell specialist's own spell hits (or heals) this much harder. */
export const SPELL_SPECIALTY_BONUS = 1.5
/** Extra damage for stacks blessed by a Bless specialist. */
export const BLESS_SPECIALTY_BONUS = 0.2

export const isSpellSpecialist = (hero: Pick<Hero, 'specialty'>, id: SpellId): boolean =>
  hero.specialty.kind === 'spell' && hero.specialty.spell === id

export function createHero(id: HeroId): Hero {
  const { faction: _faction, extraSpells, ...template } = HEROES[id]
  const maxMana = template.knowledge * 10
  return { ...template, id, mana: maxMana, maxMana, hasCastThisRound: false, spells: [...SPELL_ORDER, ...extraSpells] }
}
