import { describe, expect, it } from 'vitest'
import { SPRITES } from './sprites'

describe('sprites', () => {
  for (const [spriteId, sprite] of Object.entries(SPRITES)) {
    it(`${spriteId} is 16 by 16 pixels`, () => {
      expect(sprite.pixels).toHaveLength(16)

      for (const line of sprite.pixels) {
        expect(line).toHaveLength(16)
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
})
