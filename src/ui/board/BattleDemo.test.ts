import { describe, expect, it } from 'vitest'
import { applyMove } from '../../game'
import { startingState, STEPS, withActor } from './BattleDemo'

describe('How to play demo', () => {
  it('only makes legal moves, so it never stalls', () => {
    let state = startingState()

    for (const step of STEPS) {
      const before = withActor(state, step.actorId)
      const after = applyMove(before, step.move)
      expect(after, step.caption).not.toBe(before)
      expect(after.winner).toBeNull()
      state = after
    }
  })
})
