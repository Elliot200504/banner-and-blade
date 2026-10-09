import type { Army, Faction, HeroId, Move, Player } from '../game'

/** Bumped whenever the messages change, so mismatched players can tell. */
export const PROTOCOL_VERSION = 1

/**
 * Battles are deterministic from their seed, so players only share the setup and then each other's moves
 * (lockstep): both sides apply the same moves to the same state.
 */
export type Message =
  | { type: 'hello'; version: number }
  | {
      type: 'setup'
      seed: number
      factions: Record<Player, Faction>
      heroes: Record<Player, HeroId>
      armies: Record<Player, Army>
    }
  | { type: 'move'; move: Move }
