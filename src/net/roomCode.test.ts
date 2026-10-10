import { describe, expect, it } from 'vitest'
import { isRoomCode, newRoomCode, normalizeRoomCode } from './roomCode'

describe('room codes', () => {
  it('makes five easy to read characters', () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const code = newRoomCode()

      expect(isRoomCode(code)).toBe(true)
      expect(code).not.toMatch(/[O0I1]/)
    }
  })

  it('accepts a code typed in lower case, with spaces or a dash', () => {
    expect(normalizeRoomCode(' ab-cd e ')).toBe('ABCDE')
  })

  it('rejects codes of the wrong length or with confusable characters', () => {
    expect(isRoomCode('ABCD')).toBe(false)
    expect(isRoomCode('ABCDEF')).toBe(false)
    expect(isRoomCode('AB0DE')).toBe(false)
  })
})
