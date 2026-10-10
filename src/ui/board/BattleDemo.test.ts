import { describe, expect, it } from 'vitest'
import { applyMove } from '../../game'
import { DEMOS, withActor, type DemoId } from './BattleDemo'

describe('How to play demos', () => {
  for (const [demo, scenario] of Object.entries(DEMOS) as [DemoId, (typeof DEMOS)[DemoId]][]) {
    it(`${demo} only makes legal moves, so it never stalls`, () => {
      let state = scenario.start()

      for (const step of scenario.steps) {
        const before = withActor(state, step.actorId)
        const after = applyMove(before, step.move)
        expect(after, step.caption).not.toBe(before)
        state = after
      }

      // Only the Win demo ends the battle, and Red wins it.
      expect(state.winner).toBe(demo === 'win' ? 'red' : null)
    })
  }
})
