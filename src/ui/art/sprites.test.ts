import { describe, expect, it } from 'vitest'
import { CREATURES, type CreatureType } from '../../game'
import { RIDER_SPRITES, SPRITES } from './sprites'

/** Wide creatures, which stand on two hexes, are drawn 24 pixels wide; everything else is square. */
const widthOf = (spriteId: string) =>
  spriteId in CREATURES && CREATURES[spriteId as CreatureType].abilities.includes('wide') ? 24 : 16

describe('sprites', () => {
  for (const [spriteId, sprite] of Object.entries(SPRITES)) {
    it(`${spriteId} is ${widthOf(spriteId)} by 16 pixels`, () => {
      expect(sprite.pixels).toHaveLength(16)

      for (const line of sprite.pixels) {
        expect(line).toHaveLength(widthOf(spriteId))
      }
    })

    it(`${spriteId} only uses colors from its palette`, () => {
      const used = new Set(sprite.pixels.join(''))

      for (const character of used) {
        if (character !== '.' && character !== 'T' && character !== 't') {
          expect(sprite.palette, `pixel "${character}"`).toHaveProperty(character)
        }
      }
    })
  }

  for (const [riderId, rider] of Object.entries(RIDER_SPRITES)) {
    it(`${riderId} has three 32 by 40 frames in its palette's colors`, () => {
      expect(rider.frames).toHaveLength(3)

      for (const frame of rider.frames) {
        expect(frame).toHaveLength(40)

        for (const line of frame) {
          expect(line).toHaveLength(32)

          for (const character of line) {
            if (!['.', 'T', 't', 'U'].includes(character)) {
              expect(rider.palette, `pixel "${character}"`).toHaveProperty(character)
            }
          }
        }
      }
    })
  }
})
