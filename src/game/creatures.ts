export type Faction = 'order' | 'undead'

export type CreatureType =
  | 'spearman'
  | 'crossbowman'
  | 'gryphon'
  | 'swordsman'
  | 'priest'
  | 'knight'
  | 'skeleton'
  | 'ghoul'
  | 'wraith'
  | 'vampire'
  | 'lich'
  | 'deathKnight'

export type Ability =
  | 'flying'
  | 'doubleRetaliation'
  | 'charge'
  | 'braced'
  | 'noRetaliation'
  | 'regenerate'
  | 'deathCloud'
  | 'deathblow'
  | 'noMeleePenalty'
  | 'undead'

export interface CreatureStats {
  name: string
  plural: string
  faction: Faction
  tier: number
  hp: number
  attack: number
  defense: number
  minDamage: number
  maxDamage: number
  speed: number
  /** Ammunition. 0 means the creature has no ranged attack. */
  shots: number
  /** Furthest distance in hexes it can shoot. */
  range: number
  abilities: Ability[]
  /** Stack size in a starting army. */
  armyCount: number
}

export const CREATURES: Record<CreatureType, CreatureStats> = {
  spearman: {
    name: 'Spearman', plural: 'Spearmen', faction: 'order', tier: 1,
    hp: 10, attack: 4, defense: 5, minDamage: 1, maxDamage: 3, speed: 4, shots: 0, range: 0,
    abilities: ['braced'], armyCount: 20,
  },
  crossbowman: {
    name: 'Crossbowman', plural: 'Crossbowmen', faction: 'order', tier: 2,
    hp: 10, attack: 6, defense: 3, minDamage: 2, maxDamage: 3, speed: 4, shots: 10, range: 6,
    abilities: [], armyCount: 14,
  },
  gryphon: {
    name: 'Gryphon', plural: 'Gryphons', faction: 'order', tier: 3,
    hp: 25, attack: 8, defense: 8, minDamage: 3, maxDamage: 6, speed: 6, shots: 0, range: 0,
    abilities: ['flying', 'doubleRetaliation'], armyCount: 7,
  },
  swordsman: {
    name: 'Swordsman', plural: 'Swordsmen', faction: 'order', tier: 4,
    hp: 35, attack: 10, defense: 12, minDamage: 6, maxDamage: 9, speed: 5, shots: 0, range: 0,
    abilities: [], armyCount: 5,
  },
  priest: {
    name: 'Priest', plural: 'Priests', faction: 'order', tier: 5,
    hp: 30, attack: 12, defense: 7, minDamage: 10, maxDamage: 12, speed: 5, shots: 12, range: 7,
    abilities: ['noMeleePenalty'], armyCount: 3,
  },
  knight: {
    name: 'Knight', plural: 'Knights', faction: 'order', tier: 6,
    hp: 100, attack: 15, defense: 15, minDamage: 15, maxDamage: 25, speed: 7, shots: 0, range: 0,
    abilities: ['charge'], armyCount: 2,
  },
  skeleton: {
    name: 'Skeleton', plural: 'Skeletons', faction: 'undead', tier: 1,
    hp: 6, attack: 5, defense: 4, minDamage: 1, maxDamage: 3, speed: 4, shots: 0, range: 0,
    abilities: ['undead'], armyCount: 24,
  },
  ghoul: {
    name: 'Ghoul', plural: 'Ghouls', faction: 'undead', tier: 2,
    hp: 20, attack: 5, defense: 5, minDamage: 2, maxDamage: 3, speed: 3, shots: 0, range: 0,
    abilities: ['undead'], armyCount: 12,
  },
  wraith: {
    name: 'Wraith', plural: 'Wraiths', faction: 'undead', tier: 3,
    hp: 18, attack: 7, defense: 7, minDamage: 3, maxDamage: 5, speed: 5, shots: 0, range: 0,
    abilities: ['undead', 'flying', 'regenerate'], armyCount: 7,
  },
  vampire: {
    name: 'Vampire', plural: 'Vampires', faction: 'undead', tier: 4,
    hp: 30, attack: 10, defense: 9, minDamage: 5, maxDamage: 8, speed: 6, shots: 0, range: 0,
    abilities: ['undead', 'flying', 'noRetaliation'], armyCount: 5,
  },
  lich: {
    name: 'Lich', plural: 'Liches', faction: 'undead', tier: 5,
    hp: 30, attack: 13, defense: 10, minDamage: 11, maxDamage: 13, speed: 6, shots: 12, range: 7,
    abilities: ['undead', 'deathCloud'], armyCount: 3,
  },
  deathKnight: {
    name: 'Death Knight', plural: 'Death Knights', faction: 'undead', tier: 6,
    hp: 100, attack: 16, defense: 16, minDamage: 15, maxDamage: 30, speed: 6, shots: 0, range: 0,
    abilities: ['undead', 'deathblow'], armyCount: 2,
  },
}

export const ABILITY_DESCRIPTIONS: Record<Ability, string> = {
  flying: 'Flies over units and obstacels.',
  doubleRetaliation: 'Strikes back twice per rond.',
  charge: '+5% damage for every hex moved before attacking.',
  braced: 'Immune to the charge bonus.',
  noRetaliation: 'Enemies cannot strike back.',
  regenerate: 'Top creature heals fully at the start of its turn.',
  deathCloud: 'Shots also hit every living stack next to the target.',
  deathblow: '20% chance to deal double damage.',
  noMeleePenalty: 'No penalty when fighting in melee.',
  undead: 'Undead: unaffected by morale and death clouds.',
}

export const FACTIONS: Record<Faction, { name: string; description: string; creatures: CreatureType[] }> = {
  order: {
    name: 'Order',
    description: 'Disciplined soldiers, holy priests and charging knights.',
    creatures: ['spearman', 'crossbowman', 'gryphon', 'swordsman', 'priest', 'knight'],
  },
  undead: {
    name: 'Undead',
    description: 'Endless bones, regenerating wraiths and death magic.',
    creatures: ['skeleton', 'ghoul', 'wraith', 'vampire', 'lich', 'deathKnight'],
  },
}

export const hasAbility = (type: CreatureType, ability: Ability): boolean => CREATURES[type].abilities.includes(ability)
