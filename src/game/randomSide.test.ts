import { describe, expect, it } from 'vitest'
import { heroesOf } from './heroes'
import { rollRandomSide } from './randomSide'
import { sizedArmy } from './army'

describe('random sides', () => {
  it('roll the same town, hero and army from the same seed', () => {
    expect(rollRandomSide(1234, 'red', 'medium')).toEqual(rollRandomSide(1234, 'red', 'medium'))
  })

  it('give a hero of the rolled town and its standard army of the chosen size', () => {
    for (let seed = 0; seed < 40; seed++) {
      const rolled = rollRandomSide(seed, 'blue', 'large')

      expect(heroesOf(rolled.faction)).toContain(rolled.hero)
      expect(rolled.army).toEqual(sizedArmy(rolled.faction, 'large'))
    }
  })

  it('roll each side on its own', () => {
    const differ = Array.from({ length: 40 }, (_, seed) => seed).some(
      (seed) => rollRandomSide(seed, 'red', 'small').faction !== rollRandomSide(seed, 'blue', 'small').faction,
    )

    expect(differ).toBe(true)
  })
})
