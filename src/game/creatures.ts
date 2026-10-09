export type Faction = 'castle' | 'rampart' | 'stronghold' | 'necropolis' | 'dungeon' | 'inferno'

/** Machines any army can buy: they never move, and fight or help from where they stand. */
export type WarMachine = 'ballista' | 'firstAidTent' | 'ammoCart'

/** The creatures each town recruits before upgrading. */
export type BaseCreature =
  | 'pikeman' | 'archer' | 'griffin' | 'swordsman' | 'monk' | 'cavalier' | 'angel'
  | 'centaur' | 'dwarf' | 'woodElf' | 'pegasus' | 'dendroidGuard' | 'unicorn' | 'greenDragon'
  | 'goblin' | 'wolfRider' | 'orc' | 'ogre' | 'roc' | 'cyclops' | 'behemoth'
  | 'skeleton' | 'walkingDead' | 'wight' | 'vampire' | 'lich' | 'blackKnight' | 'boneDragon'
  | 'troglodyte' | 'harpy' | 'beholder' | 'medusa' | 'minotaur' | 'manticore' | 'redDragon'
  | 'imp' | 'gog' | 'hellHound' | 'demon' | 'pitFiend' | 'efreet' | 'devil'

/** The stronger, pricier version of each creature, as in HoMM3. */
export type UpgradedCreature =
  | 'halberdier' | 'marksman' | 'royalGriffin' | 'crusader' | 'zealot' | 'champion' | 'archangel'
  | 'centaurCaptain' | 'battleDwarf' | 'grandElf' | 'silverPegasus' | 'dendroidSoldier' | 'warUnicorn' | 'goldDragon'
  | 'hobgoblin' | 'wolfRaider' | 'orcChieftain' | 'ogreMage' | 'thunderbird' | 'cyclopsKing' | 'ancientBehemoth'
  | 'skeletonWarrior' | 'zombie' | 'wraith' | 'vampireLord' | 'powerLich' | 'dreadKnight' | 'ghostDragon'
  | 'infernalTroglodyte' | 'harpyHag' | 'evilEye' | 'medusaQueen' | 'minotaurKing' | 'scorpicore' | 'blackDragon'
  | 'familiar' | 'magog' | 'cerberus' | 'hornedDemon' | 'pitLord' | 'efreetSultan' | 'archDevil'

export type CreatureType = WarMachine | BaseCreature | UpgradedCreature

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
  | 'hitAndRun'
  | 'petrify'
  | 'steadfast'
  | 'breath'
  | 'hatred'
  | 'fearsome'
  | 'spellImmune'
  | 'magicResistance'
  | 'crushing'
  | 'cursing'
  | 'doubleShot'
  | 'doubleStrike'
  | 'unlimitedRetaliation'
  | 'lifeDrain'
  | 'warMachine'
  | 'firstAid'
  | 'ammoSupply'

export interface CreatureStats {
  name: string
  plural: string
  /** War machines belong to no faction: any army can buy them. */
  faction: Faction | null
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
  /** Stack size in the faction's standard army: one week of HoMM3 growth. */
  armyCount: number
  /** Gold to recruit one, when building an army. */
  cost: number
}

export const CREATURES: Record<CreatureType, CreatureStats> = {
  ballista: {
    name: 'Ballista', plural: 'Ballista', faction: null, tier: 0,
    hp: 250, attack: 10, defense: 10, minDamage: 25, maxDamage: 35, speed: 1, shots: 24, range: 20,
    abilities: ['warMachine'], armyCount: 1, cost: 1000,
  },
  firstAidTent: {
    name: 'First Aid Tent', plural: 'First Aid Tent', faction: null, tier: 0,
    hp: 75, attack: 0, defense: 0, minDamage: 0, maxDamage: 0, speed: 0, shots: 0, range: 0,
    abilities: ['warMachine', 'firstAid'], armyCount: 1, cost: 500,
  },
  ammoCart: {
    name: 'Ammo Cart', plural: 'Ammo Cart', faction: null, tier: 0,
    hp: 100, attack: 0, defense: 5, minDamage: 0, maxDamage: 0, speed: 0, shots: 0, range: 0,
    abilities: ['warMachine', 'ammoSupply'], armyCount: 1, cost: 400,
  },
  pikeman: {
    name: 'Pikeman', plural: 'Pikemen', faction: 'castle', tier: 1,
    hp: 10, attack: 4, defense: 5, minDamage: 1, maxDamage: 3, speed: 4, shots: 0, range: 0,
    abilities: ['braced'], armyCount: 14, cost: 60,
  },
  archer: {
    name: 'Archer', plural: 'Archers', faction: 'castle', tier: 2,
    hp: 10, attack: 6, defense: 3, minDamage: 2, maxDamage: 3, speed: 4, shots: 12, range: 6,
    abilities: [], armyCount: 9, cost: 100,
  },
  griffin: {
    name: 'Griffin', plural: 'Griffins', faction: 'castle', tier: 3,
    hp: 25, attack: 8, defense: 8, minDamage: 3, maxDamage: 6, speed: 6, shots: 0, range: 0,
    abilities: ['flying', 'doubleRetaliation'], armyCount: 7, cost: 200,
  },
  swordsman: {
    name: 'Swordsman', plural: 'Swordsmen', faction: 'castle', tier: 4,
    hp: 35, attack: 10, defense: 12, minDamage: 6, maxDamage: 9, speed: 5, shots: 0, range: 0,
    abilities: [], armyCount: 4, cost: 300,
  },
  monk: {
    name: 'Monk', plural: 'Monks', faction: 'castle', tier: 5,
    hp: 30, attack: 12, defense: 7, minDamage: 10, maxDamage: 12, speed: 5, shots: 12, range: 7,
    abilities: ['noMeleePenalty'], armyCount: 3, cost: 400,
  },
  cavalier: {
    name: 'Cavalier', plural: 'Cavaliers', faction: 'castle', tier: 6,
    hp: 100, attack: 15, defense: 15, minDamage: 15, maxDamage: 25, speed: 7, shots: 0, range: 0,
    abilities: ['charge'], armyCount: 2, cost: 1000,
  },
  angel: {
    name: 'Angel', plural: 'Angels', faction: 'castle', tier: 7,
    hp: 200, attack: 20, defense: 20, minDamage: 50, maxDamage: 50, speed: 12, shots: 0, range: 0,
    abilities: ['flying', 'hatred', 'steadfast'], armyCount: 1, cost: 3000,
  },
  centaur: {
    name: 'Centaur', plural: 'Centaurs', faction: 'rampart', tier: 1,
    hp: 8, attack: 5, defense: 3, minDamage: 2, maxDamage: 3, speed: 6, shots: 0, range: 0,
    abilities: [], armyCount: 14, cost: 70,
  },
  dwarf: {
    name: 'Dwarf', plural: 'Dwarves', faction: 'rampart', tier: 2,
    hp: 20, attack: 6, defense: 5, minDamage: 2, maxDamage: 4, speed: 3, shots: 0, range: 0,
    abilities: ['magicResistance'], armyCount: 8, cost: 120,
  },
  woodElf: {
    name: 'Wood Elf', plural: 'Wood Elves', faction: 'rampart', tier: 3,
    hp: 15, attack: 9, defense: 5, minDamage: 3, maxDamage: 5, speed: 6, shots: 24, range: 7,
    abilities: [], armyCount: 7, cost: 200,
  },
  pegasus: {
    name: 'Pegasus', plural: 'Pegasi', faction: 'rampart', tier: 4,
    hp: 30, attack: 9, defense: 8, minDamage: 5, maxDamage: 9, speed: 8, shots: 0, range: 0,
    abilities: ['flying'], armyCount: 5, cost: 250,
  },
  dendroidGuard: {
    name: 'Dendroid Guard', plural: 'Dendroid Guards', faction: 'rampart', tier: 5,
    hp: 55, attack: 9, defense: 12, minDamage: 10, maxDamage: 14, speed: 3, shots: 0, range: 0,
    abilities: [], armyCount: 3, cost: 350,
  },
  unicorn: {
    name: 'Unicorn', plural: 'Unicorns', faction: 'rampart', tier: 6,
    hp: 90, attack: 15, defense: 14, minDamage: 18, maxDamage: 22, speed: 7, shots: 0, range: 0,
    abilities: [], armyCount: 2, cost: 850,
  },
  greenDragon: {
    name: 'Green Dragon', plural: 'Green Dragons', faction: 'rampart', tier: 7,
    hp: 180, attack: 18, defense: 18, minDamage: 40, maxDamage: 50, speed: 10, shots: 0, range: 0,
    abilities: ['flying', 'breath', 'spellImmune'], armyCount: 1, cost: 2400,
  },
  goblin: {
    name: 'Goblin', plural: 'Goblins', faction: 'stronghold', tier: 1,
    hp: 5, attack: 4, defense: 2, minDamage: 1, maxDamage: 2, speed: 5, shots: 0, range: 0,
    abilities: [], armyCount: 15, cost: 40,
  },
  wolfRider: {
    name: 'Wolf Rider', plural: 'Wolf Riders', faction: 'stronghold', tier: 2,
    hp: 10, attack: 7, defense: 5, minDamage: 2, maxDamage: 4, speed: 6, shots: 0, range: 0,
    abilities: [], armyCount: 9, cost: 100,
  },
  orc: {
    name: 'Orc', plural: 'Orcs', faction: 'stronghold', tier: 3,
    hp: 15, attack: 8, defense: 4, minDamage: 2, maxDamage: 5, speed: 4, shots: 12, range: 6,
    abilities: [], armyCount: 7, cost: 150,
  },
  ogre: {
    name: 'Ogre', plural: 'Ogres', faction: 'stronghold', tier: 4,
    hp: 40, attack: 13, defense: 7, minDamage: 6, maxDamage: 12, speed: 4, shots: 0, range: 0,
    abilities: [], armyCount: 4, cost: 300,
  },
  roc: {
    name: 'Roc', plural: 'Rocs', faction: 'stronghold', tier: 5,
    hp: 60, attack: 13, defense: 11, minDamage: 11, maxDamage: 15, speed: 7, shots: 0, range: 0,
    abilities: ['flying'], armyCount: 3, cost: 600,
  },
  cyclops: {
    name: 'Cyclops', plural: 'Cyclopes', faction: 'stronghold', tier: 6,
    hp: 70, attack: 15, defense: 12, minDamage: 16, maxDamage: 20, speed: 6, shots: 16, range: 7,
    abilities: [], armyCount: 2, cost: 750,
  },
  behemoth: {
    name: 'Behemoth', plural: 'Behemoths', faction: 'stronghold', tier: 7,
    hp: 160, attack: 17, defense: 17, minDamage: 30, maxDamage: 50, speed: 6, shots: 0, range: 0,
    abilities: ['crushing'], armyCount: 1, cost: 1500,
  },
  skeleton: {
    name: 'Skeleton', plural: 'Skeletons', faction: 'necropolis', tier: 1,
    hp: 6, attack: 5, defense: 4, minDamage: 1, maxDamage: 3, speed: 4, shots: 0, range: 0,
    abilities: ['undead'], armyCount: 12, cost: 60,
  },
  walkingDead: {
    name: 'Walking Dead', plural: 'Walking Dead', faction: 'necropolis', tier: 2,
    hp: 15, attack: 5, defense: 5, minDamage: 2, maxDamage: 3, speed: 3, shots: 0, range: 0,
    abilities: ['undead'], armyCount: 8, cost: 100,
  },
  wight: {
    name: 'Wight', plural: 'Wights', faction: 'necropolis', tier: 3,
    hp: 18, attack: 7, defense: 7, minDamage: 3, maxDamage: 5, speed: 5, shots: 0, range: 0,
    abilities: ['undead', 'flying', 'regenerate'], armyCount: 7, cost: 200,
  },
  vampire: {
    name: 'Vampire', plural: 'Vampires', faction: 'necropolis', tier: 4,
    hp: 30, attack: 10, defense: 9, minDamage: 5, maxDamage: 8, speed: 6, shots: 0, range: 0,
    abilities: ['undead', 'flying', 'noRetaliation'], armyCount: 4, cost: 360,
  },
  lich: {
    name: 'Lich', plural: 'Liches', faction: 'necropolis', tier: 5,
    hp: 30, attack: 13, defense: 10, minDamage: 11, maxDamage: 13, speed: 6, shots: 12, range: 7,
    abilities: ['undead', 'deathCloud'], armyCount: 3, cost: 550,
  },
  blackKnight: {
    name: 'Black Knight', plural: 'Black Knights', faction: 'necropolis', tier: 6,
    hp: 120, attack: 16, defense: 16, minDamage: 15, maxDamage: 30, speed: 7, shots: 0, range: 0,
    abilities: ['undead', 'cursing'], armyCount: 2, cost: 1200,
  },
  boneDragon: {
    name: 'Bone Dragon', plural: 'Bone Dragons', faction: 'necropolis', tier: 7,
    hp: 150, attack: 17, defense: 15, minDamage: 25, maxDamage: 50, speed: 9, shots: 0, range: 0,
    abilities: ['undead', 'flying', 'fearsome'], armyCount: 1, cost: 1800,
  },
  troglodyte: {
    name: 'Troglodyte', plural: 'Troglodytes', faction: 'dungeon', tier: 1,
    hp: 5, attack: 4, defense: 3, minDamage: 1, maxDamage: 3, speed: 4, shots: 0, range: 0,
    abilities: [], armyCount: 14, cost: 50,
  },
  harpy: {
    name: 'Harpy', plural: 'Harpies', faction: 'dungeon', tier: 2,
    hp: 14, attack: 6, defense: 5, minDamage: 1, maxDamage: 4, speed: 6, shots: 0, range: 0,
    abilities: ['flying', 'hitAndRun'], armyCount: 8, cost: 130,
  },
  beholder: {
    name: 'Beholder', plural: 'Beholders', faction: 'dungeon', tier: 3,
    hp: 22, attack: 9, defense: 7, minDamage: 3, maxDamage: 5, speed: 5, shots: 12, range: 6,
    abilities: ['noMeleePenalty'], armyCount: 7, cost: 250,
  },
  medusa: {
    name: 'Medusa', plural: 'Medusas', faction: 'dungeon', tier: 4,
    hp: 25, attack: 9, defense: 9, minDamage: 6, maxDamage: 8, speed: 5, shots: 4, range: 5,
    abilities: ['petrify'], armyCount: 4, cost: 300,
  },
  minotaur: {
    name: 'Minotaur', plural: 'Minotaurs', faction: 'dungeon', tier: 5,
    hp: 50, attack: 14, defense: 12, minDamage: 12, maxDamage: 20, speed: 6, shots: 0, range: 0,
    abilities: ['steadfast', 'doubleRetaliation'], armyCount: 3, cost: 500,
  },
  manticore: {
    name: 'Manticore', plural: 'Manticores', faction: 'dungeon', tier: 6,
    hp: 80, attack: 15, defense: 13, minDamage: 14, maxDamage: 20, speed: 7, shots: 0, range: 0,
    abilities: ['flying'], armyCount: 2, cost: 850,
  },
  redDragon: {
    name: 'Red Dragon', plural: 'Red Dragons', faction: 'dungeon', tier: 7,
    hp: 180, attack: 19, defense: 19, minDamage: 40, maxDamage: 50, speed: 11, shots: 0, range: 0,
    abilities: ['flying', 'breath', 'spellImmune'], armyCount: 1, cost: 2500,
  },
  imp: {
    name: 'Imp', plural: 'Imps', faction: 'inferno', tier: 1,
    hp: 4, attack: 2, defense: 3, minDamage: 1, maxDamage: 2, speed: 5, shots: 0, range: 0,
    abilities: [], armyCount: 15, cost: 50,
  },
  gog: {
    name: 'Gog', plural: 'Gogs', faction: 'inferno', tier: 2,
    hp: 13, attack: 6, defense: 4, minDamage: 2, maxDamage: 4, speed: 4, shots: 12, range: 6,
    abilities: [], armyCount: 8, cost: 125,
  },
  hellHound: {
    name: 'Hell Hound', plural: 'Hell Hounds', faction: 'inferno', tier: 3,
    hp: 25, attack: 10, defense: 6, minDamage: 2, maxDamage: 7, speed: 7, shots: 0, range: 0,
    abilities: [], armyCount: 5, cost: 200,
  },
  demon: {
    name: 'Demon', plural: 'Demons', faction: 'inferno', tier: 4,
    hp: 35, attack: 10, defense: 10, minDamage: 7, maxDamage: 9, speed: 5, shots: 0, range: 0,
    abilities: [], armyCount: 4, cost: 250,
  },
  pitFiend: {
    name: 'Pit Fiend', plural: 'Pit Fiends', faction: 'inferno', tier: 5,
    hp: 45, attack: 13, defense: 13, minDamage: 13, maxDamage: 17, speed: 6, shots: 0, range: 0,
    abilities: [], armyCount: 3, cost: 500,
  },
  efreet: {
    name: 'Efreet', plural: 'Efreeti', faction: 'inferno', tier: 6,
    hp: 90, attack: 16, defense: 12, minDamage: 16, maxDamage: 24, speed: 9, shots: 0, range: 0,
    abilities: ['flying'], armyCount: 2, cost: 900,
  },
  devil: {
    name: 'Devil', plural: 'Devils', faction: 'inferno', tier: 7,
    hp: 160, attack: 19, defense: 21, minDamage: 30, maxDamage: 40, speed: 11, shots: 0, range: 0,
    abilities: ['flying', 'noRetaliation', 'hatred'], armyCount: 1, cost: 2700,
  },
  halberdier: {
    name: 'Halberdier', plural: 'Halberdiers', faction: 'castle', tier: 1,
    hp: 10, attack: 6, defense: 5, minDamage: 2, maxDamage: 3, speed: 5, shots: 0, range: 0,
    abilities: ['braced'], armyCount: 14, cost: 75,
  },
  marksman: {
    name: 'Marksman', plural: 'Marksmen', faction: 'castle', tier: 2,
    hp: 10, attack: 6, defense: 3, minDamage: 2, maxDamage: 3, speed: 6, shots: 24, range: 7,
    abilities: ['doubleShot'], armyCount: 9, cost: 150,
  },
  royalGriffin: {
    name: 'Royal Griffin', plural: 'Royal Griffins', faction: 'castle', tier: 3,
    hp: 25, attack: 9, defense: 9, minDamage: 3, maxDamage: 6, speed: 9, shots: 0, range: 0,
    abilities: ['flying', 'unlimitedRetaliation'], armyCount: 7, cost: 240,
  },
  crusader: {
    name: 'Crusader', plural: 'Crusaders', faction: 'castle', tier: 4,
    hp: 35, attack: 12, defense: 12, minDamage: 7, maxDamage: 10, speed: 6, shots: 0, range: 0,
    abilities: ['doubleStrike'], armyCount: 4, cost: 400,
  },
  zealot: {
    name: 'Zealot', plural: 'Zealots', faction: 'castle', tier: 5,
    hp: 30, attack: 12, defense: 10, minDamage: 10, maxDamage: 12, speed: 7, shots: 24, range: 7,
    abilities: ['noMeleePenalty'], armyCount: 3, cost: 450,
  },
  champion: {
    name: 'Champion', plural: 'Champions', faction: 'castle', tier: 6,
    hp: 100, attack: 16, defense: 16, minDamage: 20, maxDamage: 25, speed: 9, shots: 0, range: 0,
    abilities: ['charge'], armyCount: 2, cost: 1200,
  },
  archangel: {
    name: 'Archangel', plural: 'Archangels', faction: 'castle', tier: 7,
    hp: 250, attack: 30, defense: 30, minDamage: 50, maxDamage: 50, speed: 18, shots: 0, range: 0,
    abilities: ['flying', 'hatred', 'steadfast'], armyCount: 1, cost: 5000,
  },
  centaurCaptain: {
    name: 'Centaur Captain', plural: 'Centaur Captains', faction: 'rampart', tier: 1,
    hp: 10, attack: 6, defense: 3, minDamage: 2, maxDamage: 3, speed: 8, shots: 0, range: 0,
    abilities: [], armyCount: 14, cost: 90,
  },
  battleDwarf: {
    name: 'Battle Dwarf', plural: 'Battle Dwarves', faction: 'rampart', tier: 2,
    hp: 20, attack: 7, defense: 7, minDamage: 2, maxDamage: 4, speed: 5, shots: 0, range: 0,
    abilities: ['magicResistance'], armyCount: 8, cost: 150,
  },
  grandElf: {
    name: 'Grand Elf', plural: 'Grand Elves', faction: 'rampart', tier: 3,
    hp: 15, attack: 9, defense: 5, minDamage: 3, maxDamage: 5, speed: 7, shots: 24, range: 7,
    abilities: ['doubleShot'], armyCount: 7, cost: 225,
  },
  silverPegasus: {
    name: 'Silver Pegasus', plural: 'Silver Pegasi', faction: 'rampart', tier: 4,
    hp: 30, attack: 9, defense: 10, minDamage: 5, maxDamage: 9, speed: 12, shots: 0, range: 0,
    abilities: ['flying'], armyCount: 5, cost: 275,
  },
  dendroidSoldier: {
    name: 'Dendroid Soldier', plural: 'Dendroid Soldiers', faction: 'rampart', tier: 5,
    hp: 65, attack: 9, defense: 12, minDamage: 10, maxDamage: 14, speed: 4, shots: 0, range: 0,
    abilities: [], armyCount: 3, cost: 425,
  },
  warUnicorn: {
    name: 'War Unicorn', plural: 'War Unicorns', faction: 'rampart', tier: 6,
    hp: 110, attack: 15, defense: 14, minDamage: 18, maxDamage: 22, speed: 9, shots: 0, range: 0,
    abilities: [], armyCount: 2, cost: 950,
  },
  goldDragon: {
    name: 'Gold Dragon', plural: 'Gold Dragons', faction: 'rampart', tier: 7,
    hp: 250, attack: 27, defense: 27, minDamage: 40, maxDamage: 50, speed: 16, shots: 0, range: 0,
    abilities: ['flying', 'breath', 'spellImmune'], armyCount: 1, cost: 4000,
  },
  hobgoblin: {
    name: 'Hobgoblin', plural: 'Hobgoblins', faction: 'stronghold', tier: 1,
    hp: 5, attack: 5, defense: 3, minDamage: 1, maxDamage: 2, speed: 7, shots: 0, range: 0,
    abilities: [], armyCount: 15, cost: 50,
  },
  wolfRaider: {
    name: 'Wolf Raider', plural: 'Wolf Raiders', faction: 'stronghold', tier: 2,
    hp: 10, attack: 8, defense: 5, minDamage: 3, maxDamage: 4, speed: 8, shots: 0, range: 0,
    abilities: ['doubleStrike'], armyCount: 9, cost: 140,
  },
  orcChieftain: {
    name: 'Orc Chieftain', plural: 'Orc Chieftains', faction: 'stronghold', tier: 3,
    hp: 20, attack: 8, defense: 4, minDamage: 2, maxDamage: 5, speed: 5, shots: 24, range: 6,
    abilities: [], armyCount: 7, cost: 165,
  },
  ogreMage: {
    name: 'Ogre Mage', plural: 'Ogre Magi', faction: 'stronghold', tier: 4,
    hp: 60, attack: 13, defense: 7, minDamage: 6, maxDamage: 12, speed: 5, shots: 0, range: 0,
    abilities: [], armyCount: 4, cost: 400,
  },
  thunderbird: {
    name: 'Thunderbird', plural: 'Thunderbirds', faction: 'stronghold', tier: 5,
    hp: 60, attack: 13, defense: 11, minDamage: 11, maxDamage: 15, speed: 11, shots: 0, range: 0,
    abilities: ['flying'], armyCount: 3, cost: 700,
  },
  cyclopsKing: {
    name: 'Cyclops King', plural: 'Cyclops Kings', faction: 'stronghold', tier: 6,
    hp: 70, attack: 17, defense: 13, minDamage: 16, maxDamage: 20, speed: 8, shots: 24, range: 7,
    abilities: [], armyCount: 2, cost: 1100,
  },
  ancientBehemoth: {
    name: 'Ancient Behemoth', plural: 'Ancient Behemoths', faction: 'stronghold', tier: 7,
    hp: 300, attack: 19, defense: 19, minDamage: 30, maxDamage: 50, speed: 9, shots: 0, range: 0,
    abilities: ['crushing'], armyCount: 1, cost: 3000,
  },
  skeletonWarrior: {
    name: 'Skeleton Warrior', plural: 'Skeleton Warriors', faction: 'necropolis', tier: 1,
    hp: 6, attack: 6, defense: 6, minDamage: 1, maxDamage: 3, speed: 5, shots: 0, range: 0,
    abilities: ['undead'], armyCount: 12, cost: 70,
  },
  zombie: {
    name: 'Zombie', plural: 'Zombies', faction: 'necropolis', tier: 2,
    hp: 20, attack: 5, defense: 5, minDamage: 2, maxDamage: 3, speed: 4, shots: 0, range: 0,
    abilities: ['undead'], armyCount: 8, cost: 125,
  },
  wraith: {
    name: 'Wraith', plural: 'Wraiths', faction: 'necropolis', tier: 3,
    hp: 18, attack: 7, defense: 7, minDamage: 3, maxDamage: 5, speed: 7, shots: 0, range: 0,
    abilities: ['undead', 'flying', 'regenerate'], armyCount: 7, cost: 230,
  },
  vampireLord: {
    name: 'Vampire Lord', plural: 'Vampire Lords', faction: 'necropolis', tier: 4,
    hp: 40, attack: 10, defense: 10, minDamage: 5, maxDamage: 8, speed: 9, shots: 0, range: 0,
    abilities: ['undead', 'flying', 'noRetaliation', 'lifeDrain'], armyCount: 4, cost: 500,
  },
  powerLich: {
    name: 'Power Lich', plural: 'Power Liches', faction: 'necropolis', tier: 5,
    hp: 40, attack: 13, defense: 10, minDamage: 11, maxDamage: 15, speed: 7, shots: 24, range: 7,
    abilities: ['undead', 'deathCloud'], armyCount: 3, cost: 600,
  },
  dreadKnight: {
    name: 'Dread Knight', plural: 'Dread Knights', faction: 'necropolis', tier: 6,
    hp: 120, attack: 18, defense: 18, minDamage: 15, maxDamage: 30, speed: 9, shots: 0, range: 0,
    abilities: ['undead', 'cursing', 'deathblow'], armyCount: 2, cost: 1500,
  },
  ghostDragon: {
    name: 'Ghost Dragon', plural: 'Ghost Dragons', faction: 'necropolis', tier: 7,
    hp: 200, attack: 19, defense: 17, minDamage: 25, maxDamage: 50, speed: 14, shots: 0, range: 0,
    abilities: ['undead', 'flying', 'fearsome'], armyCount: 1, cost: 3000,
  },
  infernalTroglodyte: {
    name: 'Infernal Troglodyte', plural: 'Infernal Troglodytes', faction: 'dungeon', tier: 1,
    hp: 6, attack: 5, defense: 4, minDamage: 1, maxDamage: 3, speed: 5, shots: 0, range: 0,
    abilities: [], armyCount: 14, cost: 65,
  },
  harpyHag: {
    name: 'Harpy Hag', plural: 'Harpy Hags', faction: 'dungeon', tier: 2,
    hp: 14, attack: 6, defense: 6, minDamage: 1, maxDamage: 4, speed: 9, shots: 0, range: 0,
    abilities: ['flying', 'hitAndRun', 'noRetaliation'], armyCount: 8, cost: 170,
  },
  evilEye: {
    name: 'Evil Eye', plural: 'Evil Eyes', faction: 'dungeon', tier: 3,
    hp: 22, attack: 10, defense: 8, minDamage: 3, maxDamage: 5, speed: 7, shots: 24, range: 6,
    abilities: ['noMeleePenalty'], armyCount: 7, cost: 280,
  },
  medusaQueen: {
    name: 'Medusa Queen', plural: 'Medusa Queens', faction: 'dungeon', tier: 4,
    hp: 30, attack: 10, defense: 10, minDamage: 6, maxDamage: 8, speed: 6, shots: 8, range: 5,
    abilities: ['petrify', 'noMeleePenalty'], armyCount: 4, cost: 330,
  },
  minotaurKing: {
    name: 'Minotaur King', plural: 'Minotaur Kings', faction: 'dungeon', tier: 5,
    hp: 50, attack: 15, defense: 15, minDamage: 12, maxDamage: 20, speed: 8, shots: 0, range: 0,
    abilities: ['steadfast', 'doubleRetaliation'], armyCount: 3, cost: 575,
  },
  scorpicore: {
    name: 'Scorpicore', plural: 'Scorpicores', faction: 'dungeon', tier: 6,
    hp: 80, attack: 16, defense: 14, minDamage: 14, maxDamage: 20, speed: 11, shots: 0, range: 0,
    abilities: ['flying'], armyCount: 2, cost: 1050,
  },
  blackDragon: {
    name: 'Black Dragon', plural: 'Black Dragons', faction: 'dungeon', tier: 7,
    hp: 300, attack: 25, defense: 25, minDamage: 40, maxDamage: 50, speed: 15, shots: 0, range: 0,
    abilities: ['flying', 'breath', 'spellImmune'], armyCount: 1, cost: 4000,
  },
  familiar: {
    name: 'Familiar', plural: 'Familiars', faction: 'inferno', tier: 1,
    hp: 4, attack: 4, defense: 4, minDamage: 1, maxDamage: 2, speed: 7, shots: 0, range: 0,
    abilities: [], armyCount: 15, cost: 60,
  },
  magog: {
    name: 'Magog', plural: 'Magogs', faction: 'inferno', tier: 2,
    hp: 13, attack: 7, defense: 4, minDamage: 2, maxDamage: 4, speed: 6, shots: 24, range: 6,
    abilities: [], armyCount: 8, cost: 175,
  },
  cerberus: {
    name: 'Cerberus', plural: 'Cerberi', faction: 'inferno', tier: 3,
    hp: 25, attack: 10, defense: 8, minDamage: 2, maxDamage: 7, speed: 8, shots: 0, range: 0,
    abilities: ['noRetaliation'], armyCount: 5, cost: 250,
  },
  hornedDemon: {
    name: 'Horned Demon', plural: 'Horned Demons', faction: 'inferno', tier: 4,
    hp: 40, attack: 10, defense: 10, minDamage: 7, maxDamage: 9, speed: 6, shots: 0, range: 0,
    abilities: [], armyCount: 4, cost: 270,
  },
  pitLord: {
    name: 'Pit Lord', plural: 'Pit Lords', faction: 'inferno', tier: 5,
    hp: 45, attack: 13, defense: 13, minDamage: 13, maxDamage: 17, speed: 7, shots: 0, range: 0,
    abilities: [], armyCount: 3, cost: 700,
  },
  efreetSultan: {
    name: 'Efreet Sultan', plural: 'Efreet Sultans', faction: 'inferno', tier: 6,
    hp: 90, attack: 16, defense: 14, minDamage: 16, maxDamage: 24, speed: 13, shots: 0, range: 0,
    abilities: ['flying'], armyCount: 2, cost: 1100,
  },
  archDevil: {
    name: 'Arch Devil', plural: 'Arch Devils', faction: 'inferno', tier: 7,
    hp: 200, attack: 26, defense: 28, minDamage: 30, maxDamage: 40, speed: 17, shots: 0, range: 0,
    abilities: ['flying', 'noRetaliation', 'hatred'], armyCount: 1, cost: 4500,
  },
}

export const ABILITY_DESCRIPTIONS: Record<Ability, string> = {
  flying: 'Flies over units and obstacles.',
  doubleRetaliation: 'Strikes back twice per round.',
  charge: '+5% damage for every hex moved before attacking.',
  braced: 'Immune to the charge bonus.',
  noRetaliation: 'Enemies cannot strike back.',
  regenerate: 'Top creature heals fully at the start of its turn.',
  deathCloud: 'Shots also hit every living stack next to the target.',
  deathblow: '20% chance to deal double damage.',
  noMeleePenalty: 'No penalty when fighting in melee.',
  undead: 'Undead: unaffected by morale and death clouds.',
  hitAndRun: 'Flies back to where it started after a melee attack.',
  petrify: '20% chance to turn the target to stone: it loses its next turn and cannot strike back until it breaks free.',
  steadfast: '+1 morale on top of the hero.',
  breath: 'Melee attacks also burn the stack behind the target, friend or foe.',
  hatred: '+50% damage against its sworn enemies (Angels and Devils, and their upgrades, hate each other).',
  fearsome: 'Enemy stacks have 1 less morale while it lives.',
  spellImmune: 'Immune to spells of level 1 to 3, from friend or foe.',
  magicResistance: '20% chance to shrug off a hostile spell.',
  crushing: "Its blows ignore 40% of the target's defense.",
  cursing: '20% chance that its melee blows curse the target for 3 rounds.',
  doubleShot: 'Shoots twice.',
  doubleStrike: 'Strikes twice in melee: once before the target strikes back, and once after.',
  unlimitedRetaliation: 'Strikes back at every attacker.',
  lifeDrain: 'Its melee blows heal it by the damage dealt to the living, raising its fallen.',
  warMachine: 'War machine: never moves, never strikes back, and spells and morale do not affect it.',
  firstAid: 'At the start of each round, heals 25 to 50 health on the top creature of your most wounded stack.',
  ammoSupply: 'While it stands, your shooters never run out of shots.',
}

/** Who each hating creature hates. */
export const HATES: Partial<Record<CreatureType, CreatureType[]>> = {
  angel: ['devil', 'archDevil'],
  archangel: ['devil', 'archDevil'],
  devil: ['angel', 'archangel'],
  archDevil: ['angel', 'archangel'],
}

/** Each creature's upgrade. */
export const UPGRADES: Record<BaseCreature, UpgradedCreature> = {
  pikeman: 'halberdier',
  archer: 'marksman',
  griffin: 'royalGriffin',
  swordsman: 'crusader',
  monk: 'zealot',
  cavalier: 'champion',
  angel: 'archangel',
  centaur: 'centaurCaptain',
  dwarf: 'battleDwarf',
  woodElf: 'grandElf',
  pegasus: 'silverPegasus',
  dendroidGuard: 'dendroidSoldier',
  unicorn: 'warUnicorn',
  greenDragon: 'goldDragon',
  goblin: 'hobgoblin',
  wolfRider: 'wolfRaider',
  orc: 'orcChieftain',
  ogre: 'ogreMage',
  roc: 'thunderbird',
  cyclops: 'cyclopsKing',
  behemoth: 'ancientBehemoth',
  skeleton: 'skeletonWarrior',
  walkingDead: 'zombie',
  wight: 'wraith',
  vampire: 'vampireLord',
  lich: 'powerLich',
  blackKnight: 'dreadKnight',
  boneDragon: 'ghostDragon',
  troglodyte: 'infernalTroglodyte',
  harpy: 'harpyHag',
  beholder: 'evilEye',
  medusa: 'medusaQueen',
  minotaur: 'minotaurKing',
  manticore: 'scorpicore',
  redDragon: 'blackDragon',
  imp: 'familiar',
  gog: 'magog',
  hellHound: 'cerberus',
  demon: 'hornedDemon',
  pitFiend: 'pitLord',
  efreet: 'efreetSultan',
  devil: 'archDevil',
}

const BASE_OF = Object.fromEntries(Object.entries(UPGRADES).map(([base, upgrade]) => [upgrade, base])) as Record<
  UpgradedCreature,
  BaseCreature
>

export const isUpgraded = (type: CreatureType): type is UpgradedCreature => type in BASE_OF

/** The creature a stack is a version of: itself, or the creature it is an upgrade of. */
export const baseOf = (type: CreatureType): CreatureType => (isUpgraded(type) ? BASE_OF[type] : type)

export const FACTIONS: Record<Faction, { name: string; creatures: BaseCreature[] }> = {
  castle: {
    name: 'Castle',
    creatures: ['pikeman', 'archer', 'griffin', 'swordsman', 'monk', 'cavalier', 'angel'],
  },
  rampart: {
    name: 'Rampart',
    creatures: ['centaur', 'dwarf', 'woodElf', 'pegasus', 'dendroidGuard', 'unicorn', 'greenDragon'],
  },
  stronghold: {
    name: 'Stronghold',
    creatures: ['goblin', 'wolfRider', 'orc', 'ogre', 'roc', 'cyclops', 'behemoth'],
  },
  necropolis: {
    name: 'Necropolis',
    creatures: ['skeleton', 'walkingDead', 'wight', 'vampire', 'lich', 'blackKnight', 'boneDragon'],
  },
  dungeon: {
    name: 'Dungeon',
    creatures: ['troglodyte', 'harpy', 'beholder', 'medusa', 'minotaur', 'manticore', 'redDragon'],
  },
  inferno: {
    name: 'Inferno',
    creatures: ['imp', 'gog', 'hellHound', 'demon', 'pitFiend', 'efreet', 'devil'],
  },
}

export const FACTION_ORDER: Faction[] = ['castle', 'rampart', 'stronghold', 'necropolis', 'dungeon', 'inferno']

export const hasAbility = (type: CreatureType, ability: Ability): boolean => CREATURES[type].abilities.includes(ability)

export const WAR_MACHINES: WarMachine[] = ['ballista', 'firstAidTent', 'ammoCart']

export const isWarMachine = (type: CreatureType): type is WarMachine => hasAbility(type, 'warMachine')

/** War machines that work on their own and never take a turn. */
export const isPassive = (type: CreatureType): boolean => hasAbility(type, 'firstAid') || hasAbility(type, 'ammoSupply')
