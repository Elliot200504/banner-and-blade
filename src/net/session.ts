import type { Connection } from './connection'
import { claimRoom, hostRoom, joinRoom, NoRoomError, type Room } from './peer'
import type { Message } from './protocol'

/** How often a player left alone tries to get the game going again, and how long each try may take. */
const RETRY_MS = 2_000
const RETRY_JOIN_TIMEOUT_MS = 5_000

export type SessionStatus = 'connected' | 'waiting'

/** What makes a session: holding a room, or joining one. Tests swap these for in-page versions. */
export interface SessionLinks {
  claim: (code: string) => Promise<Room>
  join: (code: string, timeout?: number) => Promise<Connection>
}

const PEER_LINKS: SessionLinks = { claim: claimRoom, join: joinRoom }

/**
 * An online game under one room code, for as long as it lasts. The player holding the room takes in whoever
 * joins; when the other player drops or leaves, the game waits for someone to join with the code. A player
 * left alone without the room first tries to join back, and if nobody holds the room any more, takes it over,
 * so the same code always leads back into the game.
 */
export class OnlineSession {
  readonly code: string
  private links: SessionLinks
  private room: Room | null = null
  private connection: Connection | null = null
  private stopConnection: (() => void)[] = []
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private closed = false
  private messageListeners = new Set<(message: Message) => void>()
  /** Messages that arrived before anyone listened, like the catch-up right after joining. */
  private waiting: Message[] = []
  private changeListeners = new Set<() => void>()
  private joinListeners = new Set<() => void>()

  private constructor(code: string, links: SessionLinks) {
    this.code = code
    this.links = links
  }

  /** Opens a new room and waits for a friend. */
  static async host(links: SessionLinks = PEER_LINKS, newRoom: () => Promise<Room> = hostRoom): Promise<OnlineSession> {
    const room = await newRoom()
    const session = new OnlineSession(room.code, links)
    session.holdRoom(room)

    return session
  }

  /** Joins the game with this code. */
  static async join(code: string, links: SessionLinks = PEER_LINKS): Promise<OnlineSession> {
    const connection = await links.join(code)
    const session = new OnlineSession(code, links)
    session.useConnection(connection)

    return session
  }

  /** Whether the other player is here. */
  get status(): SessionStatus {
    return this.connection ? 'connected' : 'waiting'
  }

  /** Whether this browser holds the room: it starts the battles and catches up whoever joins. */
  get holdsRoom(): boolean {
    return this.room !== null
  }

  send(message: Message) {
    this.connection?.send(message)
  }

  onMessage(listener: (message: Message) => void): () => void {
    this.messageListeners.add(listener)
    this.waiting.splice(0).forEach((message) => listener(message))

    return () => this.messageListeners.delete(listener)
  }

  /** Calls `listener` whenever the status or the room changes hands. */
  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener)

    return () => this.changeListeners.delete(listener)
  }

  /** Calls `listener` when a player joins this browser's room, ready to be caught up. */
  onJoin(listener: () => void): () => void {
    this.joinListeners.add(listener)

    return () => this.joinListeners.delete(listener)
  }

  /** Leaves the game for good. The other player is told, and waits for someone to take this place. */
  leave() {
    this.send({ type: 'leave' })
    this.close()
  }

  /** Stops playing online without a word: drops the connection and gives the room up. */
  close() {
    this.closed = true

    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
    }

    this.dropConnection()
    this.room?.close()
    this.room = null
  }

  private holdRoom(room: Room) {
    this.room = room
    room.onConnection((connection) => {
      // One opponent at a time: a third player is turned away.
      if (this.connection || this.closed) {
        connection.send({ type: 'full' })
        setTimeout(() => connection.close(), 200)

        return
      }

      this.useConnection(connection)
      this.joinListeners.forEach((listener) => listener())
    })
    this.changed()
  }

  private useConnection(connection: Connection) {
    this.connection = connection
    this.stopConnection = [
      connection.onMessage((message) => {
        if (message.type === 'leave') {
          this.lost()
        } else if (this.messageListeners.size === 0) {
          this.waiting.push(message)
        } else {
          this.messageListeners.forEach((listener) => listener(message))
        }
      }),
      connection.onClose(() => this.lost()),
    ]
    this.changed()
  }

  private dropConnection() {
    this.stopConnection.forEach((stop) => stop())
    this.stopConnection = []
    this.connection?.close()
    this.connection = null
  }

  /** The other player is gone: wait for them, or someone else, to come back in. */
  private lost() {
    if (this.closed || !this.connection) {
      return
    }

    this.dropConnection()
    this.changed()

    if (!this.room) {
      this.scheduleRetry()
    }
  }

  private scheduleRetry() {
    this.retryTimer = setTimeout(() => void this.retry(), RETRY_MS)
  }

  /** Without the room: join back if someone still holds it, otherwise take it over and wait there. */
  private async retry() {
    if (this.closed || this.connection || this.room) {
      return
    }

    try {
      const connection = await this.links.join(this.code, RETRY_JOIN_TIMEOUT_MS)

      if (this.closed) {
        connection.close()

        return
      }

      this.useConnection(connection)

      return
    } catch (error) {
      if (!(error instanceof NoRoomError)) {
        this.scheduleRetry()

        return
      }
    }

    try {
      const room = await this.links.claim(this.code)

      if (this.closed) {
        room.close()

        return
      }

      this.holdRoom(room)
    } catch {
      // The old holder's claim on the code has not run out yet, or the network is down: try again shortly.
      this.scheduleRetry()
    }
  }

  private changed() {
    this.changeListeners.forEach((listener) => listener())
  }
}
