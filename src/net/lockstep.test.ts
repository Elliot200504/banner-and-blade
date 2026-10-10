import { describe, expect, it } from 'vitest'
import { activeUnit, applyMove, chooseMove, createBattle, sizedArmy, type GameState, type Move } from '../game'
import { createLocalPair } from './connection'

/** How each browser builds the battle: the shared field, then the host's dice seed. */
function battleFor(fieldSeed: number, seed: number): GameState {
  const factions = { red: 'castle', blue: 'necropolis' } as const
  const armies = { red: sizedArmy('castle', 'medium'), blue: sizedArmy('necropolis', 'medium') }

  return { ...createBattle(factions, fieldSeed, { red: 'tyris', blue: 'vokial' }, armies), seed }
}

describe('lockstep', () => {
  it('keeps both players on the same battle when they only exchange moves', () => {
    const [redEnd, blueEnd] = createLocalPair()
    let red = battleFor(1234, 99)
    let blue = battleFor(1234, 99)
    const toRed: Move[] = []
    const toBlue: Move[] = []
    redEnd.onMessage((message) => message.type === 'move' && toRed.push(message.move))
    blueEnd.onMessage((message) => message.type === 'move' && toBlue.push(message.move))

    for (let moves = 0; moves < 400 && !red.winner; moves++) {
      // Whoever's turn it is picks a move on their own copy and sends it; the other applies what arrives.
      const owner = activeUnit(red)!.owner

      if (owner === 'red') {
        const move = chooseMove(red, 'normal')
        red = applyMove(red, move)
        redEnd.send({ type: 'move', move })
        blue = applyMove(blue, toBlue.shift()!)
      } else {
        const move = chooseMove(blue, 'normal')
        blue = applyMove(blue, move)
        blueEnd.send({ type: 'move', move })
        red = applyMove(red, toRed.shift()!)
      }

      expect(blue).toEqual(red)
    }

    expect(red.winner).not.toBeNull()
  })
})
