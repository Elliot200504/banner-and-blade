import { UPGRADES, type BaseCreature, type CreatureType, type Faction, type HeroId, type ObstacleKind, type UpgradedCreature } from '../../game'
import { CASTLE_SPRITES, CASTLE_TINTS } from './castle'
import { RAMPART_SPRITES, RAMPART_TINTS } from './rampart'
import { STRONGHOLD_SPRITES, STRONGHOLD_TINTS } from './stronghold'
import { NECROPOLIS_SPRITES, NECROPOLIS_TINTS } from './necropolis'
import { DUNGEON_SPRITES, DUNGEON_TINTS } from './dungeon'
import { INFERNO_SPRITES, INFERNO_TINTS } from './inferno'
import { TOWER_SPRITES, TOWER_TINTS } from './tower'
import { FORTRESS_SPRITES, FORTRESS_TINTS } from './fortress'
import { CONFLUX_SPRITES, CONFLUX_TINTS } from './conflux'
import { OUTLINE, SKIN, type Sprite } from './shared'
import { WAR_MACHINE_SPRITES } from './warMachines'

export type { Sprite } from './shared'

/** Every creature, hero, obstacle and town has a sprite of the same name. */
export type SpriteId = CreatureType | HeroId | ObstacleKind | Faction

/**
 * Pixel art for every unit, obstacle and town, one file per town. The characters 'T' (team color)
 * and 't' (darker team shade) are never listed in a palette: the renderer substitutes the owning
 * player's colors for them. All creatures face right.
 */
const BASE_SPRITES: Record<Exclude<SpriteId, UpgradedCreature>, Sprite> = {
  ...WAR_MACHINE_SPRITES,
  ...CASTLE_SPRITES,
  ...RAMPART_SPRITES,
  ...STRONGHOLD_SPRITES,
  ...NECROPOLIS_SPRITES,
  ...DUNGEON_SPRITES,
  ...INFERNO_SPRITES,
  ...TOWER_SPRITES,
  ...FORTRESS_SPRITES,
  ...CONFLUX_SPRITES,
}

const UPGRADE_TINTS: Record<UpgradedCreature, string> = {
  ...CASTLE_TINTS,
  ...RAMPART_TINTS,
  ...STRONGHOLD_TINTS,
  ...NECROPOLIS_TINTS,
  ...DUNGEON_TINTS,
  ...INFERNO_TINTS,
  ...TOWER_TINTS,
  ...FORTRESS_TINTS,
  ...CONFLUX_TINTS,
}

/** How far each color moves toward the upgrade's tint. */
const TINT_STRENGTH = 0.5

const channels = (color: string) => [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16))

/** Outlines, skin and near-black shadows keep their color, so the creature still reads as itself. */
function keepsColor(color: string): boolean {
  const [red, green, blue] = channels(color)

  return color === OUTLINE || color === SKIN || 0.3 * red + 0.59 * green + 0.11 * blue < 40
}

function mix(color: string, tint: string): string {
  const tintChannels = channels(tint)

  return `#${channels(color)
    .map((channel, index) => Math.round(channel + (tintChannels[index] - channel) * TINT_STRENGTH).toString(16).padStart(2, '0'))
    .join('')}`
}

function tinted(sprite: Sprite, tint: string): Sprite {
  const palette = Object.fromEntries(
    Object.entries(sprite.palette).map(([character, color]) => [character, keepsColor(color) ? color : mix(color, tint)]),
  )

  return { palette, pixels: sprite.pixels }
}

const UPGRADE_SPRITES = Object.fromEntries(
  Object.entries(UPGRADES).map(([base, upgrade]) => [upgrade, tinted(BASE_SPRITES[base as BaseCreature], UPGRADE_TINTS[upgrade])]),
) as Record<UpgradedCreature, Sprite>

export const SPRITES: Record<SpriteId, Sprite> = { ...BASE_SPRITES, ...UPGRADE_SPRITES }
