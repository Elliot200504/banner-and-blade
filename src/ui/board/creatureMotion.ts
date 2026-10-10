import { UPGRADES, type BaseCreature, type CreatureType } from '../../game'
import type { SoundId } from '../audio/sound'

/** How a creature sounds when it walks: each step plays this sound. */
type Gait = Extract<SoundId, 'step' | 'hoof' | 'heavyStep' | 'clatter' | 'slither' | 'shamble' | 'hover'>

/** How a creature sounds in the air: flapping wings, or a magical rush for those that fly without them. */
type Flight = 'wings' | 'heavyWings' | 'magic'

const GAITS: Partial<Record<BaseCreature, Gait>> = {
  cavalier: 'hoof',
  centaur: 'hoof',
  unicorn: 'hoof',
  blackKnight: 'hoof',
  gorgon: 'hoof',
  giant: 'heavyStep',
  cyclops: 'heavyStep',
  behemoth: 'heavyStep',
  ogre: 'heavyStep',
  stoneGolem: 'heavyStep',
  earthElemental: 'heavyStep',
  dendroidGuard: 'heavyStep',
  minotaur: 'heavyStep',
  hydra: 'heavyStep',
  skeleton: 'clatter',
  naga: 'slither',
  basilisk: 'slither',
  medusa: 'slither',
  walkingDead: 'shamble',
  waterElemental: 'hover',
  fireElemental: 'hover',
  psychicElemental: 'hover',
  airElemental: 'hover',
  beholder: 'hover',
}

const FLIGHTS: Partial<Record<BaseCreature, Flight>> = {
  greenDragon: 'heavyWings',
  redDragon: 'heavyWings',
  boneDragon: 'heavyWings',
  roc: 'heavyWings',
  firebird: 'heavyWings',
  wyvern: 'heavyWings',
  manticore: 'heavyWings',
  genie: 'magic',
  efreet: 'magic',
  wight: 'magic',
  devil: 'magic',
}

/** Upgrades move like the creature they were upgraded from. */
const BASE_OF = Object.fromEntries(Object.entries(UPGRADES).map(([base, upgrade]) => [upgrade, base])) as Partial<
  Record<CreatureType, BaseCreature>
>

const baseOf = (type: CreatureType) => BASE_OF[type] ?? (type as BaseCreature)

export const gaitOf = (type: CreatureType): Gait => GAITS[baseOf(type)] ?? 'step'

export const flightOf = (type: CreatureType): Flight => FLIGHTS[baseOf(type)] ?? 'wings'
