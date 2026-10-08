/**
 * Small seeded random generator (mulberry32). The seed lives in the game state,
 * so the rules stay pure: the same state and move always give the same result.
 */
export interface Random {
  /** A number in [0, 1). */
  next: () => number
  /** A whole number from `minimum` to `maximum`, both included. */
  integer: (minimum: number, maximum: number) => number
  chance: (probability: number) => boolean
  seed: () => number
}

export function createRandom(seed: number): Random {
  let current = seed >>> 0
  const next = () => {
    current = (current + 0x6d2b79f5) >>> 0
    let mixed = current
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    integer: (minimum, maximum) => minimum + Math.floor(next() * (maximum - minimum + 1)),
    chance: (probability) => next() < probability,
    seed: () => current,
  }
}
