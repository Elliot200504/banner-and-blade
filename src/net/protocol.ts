import type { Army, ArmySize, Faction, HeroId, Move } from '../game'

/** Bumped whenever the messages change, so mismatched players can tell. */
export const PROTOCOL_VERSION = 3

/** One side's choices on the start screen. */
export interface SidePicksMessage {
  faction: Faction
  hero: HeroId
  army: Army
  armySize: ArmySize
  /** Rolled at random: the friend's card shows a question mark instead of the picks. */
  random: boolean
}

/**
 * Battles are deterministic from their seeds, so players only share the setup and then each other's moves
 * (lockstep): both sides apply the same moves to the same state.
 *
 * - `hello` is the first message each way, to check both run the same version.
 * - `field` comes from the host, so both menus show the same battlefield and the battle is fought on it.
 * - `picks` is sent whenever a side's town, hero or army changes.
 * - `start` comes from the host when both sides are ready, with the seed that rolls the dice.
 * - `move` is one move by the sender's side.
 * - `leave` says the sender left; the connection closes after it.
 */
export type Message =
  | { type: 'hello'; version: number }
  | { type: 'field'; fieldSeed: number }
  | { type: 'picks'; picks: SidePicksMessage }
  | { type: 'start'; seed: number }
  | { type: 'move'; move: Move }
  | { type: 'leave' }
