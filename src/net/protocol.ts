import type { Army, ArmySize, Faction, HeroId, Move, Player } from '../game'

/** Bumped whenever the messages change, so mismatched players can tell. */
export const PROTOCOL_VERSION = 4

/**
 * One side's choices on the start screen. A side picked at random sends only its army size: its town, hero and
 * army are rolled from the battle's seed when the battle starts, so they cannot be read from the messages.
 */
export type SidePicksMessage =
  | { random: false; faction: Faction; hero: HeroId; army: Army; armySize: ArmySize }
  | { random: true; armySize: ArmySize }

/** Everything a player joining a game needs to catch up: sent by the player holding the room. */
export interface GameSync {
  /** The side the joining player takes over. */
  side: Player
  fieldSeed: number
  /** Each side's picks so far; null while a side has not finished choosing. */
  picks: Record<Player, SidePicksMessage | null>
  /** The battle under way, if any: its dice and every move made so far, to replay. */
  battle: { seed: number; moves: Move[] } | null
}

/**
 * Battles are deterministic from their seeds, so players only share the setup and then each other's moves
 * (lockstep): both sides apply the same moves to the same state.
 *
 * - `hello` is the first message each way on a new connection, to check both run the same version.
 * - `sync` comes from the player holding the room to whoever joins, with the whole game so far.
 * - `picks` is sent whenever a side's town, hero or army changes.
 * - `start` comes from the player holding the room when both sides are ready, with the seed that rolls the dice.
 * - `move` is one move by the sender's side.
 * - `leave` says the sender left; the game waits for someone to take their place.
 * - `full` turns away a player joining a room that already has two.
 */
export type Message =
  | { type: 'hello'; version: number }
  | { type: 'sync'; sync: GameSync }
  | { type: 'picks'; picks: SidePicksMessage }
  | { type: 'start'; seed: number }
  | { type: 'move'; move: Move }
  | { type: 'leave' }
  | { type: 'full' }
