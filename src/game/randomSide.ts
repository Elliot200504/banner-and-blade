import { sizedArmy, type Army, type ArmySize } from './army'
import { FACTION_ORDER, type Faction } from './creatures'
import { heroesOf, type HeroId } from './heroes'
import { createRandom } from './random'
import type { Player } from './types'

export interface RolledSide {
  faction: Faction
  hero: HeroId
  army: Army
}

/** Each side rolls from its own stream, so both random sides can differ even with the same seed. */
const SIDE_SALT: Record<Player, number> = { red: 0x5bd1e995, blue: 0x1b873593 }

/**
 * The town, hero and army of a side picked at random. They are rolled from the battle's seed when it starts,
 * so nobody, not even an online opponent reading the messages, knows them before the battle.
 */
export function rollRandomSide(seed: number, player: Player, size: ArmySize): RolledSide {
  const random = createRandom((seed ^ SIDE_SALT[player]) >>> 0)
  const faction = FACTION_ORDER[Math.floor(random.next() * FACTION_ORDER.length)]
  const heroes = heroesOf(faction)
  const hero = heroes[Math.floor(random.next() * heroes.length)]

  return { faction, hero, army: sizedArmy(faction, size) }
}
