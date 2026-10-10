import { Peer, type DataConnection } from 'peerjs'
import type { Connection } from './connection'
import type { Message } from './protocol'
import { newRoomCode } from './roomCode'

/**
 * Online play over WebRTC, browser to browser. PeerJS's free public server only introduces the players;
 * the moves themselves go directly between them.
 */

/** Every room is registered under this prefix, so codes cannot clash with other PeerJS apps. */
const ID_PREFIX = 'banner-and-blade-'
const JOIN_TIMEOUT_MS = 15_000
const HOST_ATTEMPTS = 3

const NETWORK_ERROR = 'Could not reach the online service. Check your connection and try again.'

/** Wraps a PeerJS data connection in the game's Connection. A joining player's peer is shut down with it. */
function wrap(dataConnection: DataConnection, ownPeer: Peer | null): Connection {
  const listeners = new Set<(message: Message) => void>()
  const closeListeners = new Set<() => void>()
  // Messages can arrive before the game starts listening, right after connecting: they wait here.
  const waiting: Message[] = []
  let closed = false
  const handleClose = () => {
    if (!closed) {
      closed = true
      closeListeners.forEach((listener) => listener())
      ownPeer?.destroy()
    }
  }

  dataConnection.on('data', (data) => {
    const message = data as Message

    if (listeners.size === 0) {
      waiting.push(message)
    } else {
      listeners.forEach((listener) => listener(message))
    }
  })
  dataConnection.on('close', handleClose)
  dataConnection.on('error', handleClose)
  ownPeer?.on('disconnected', () => {
    // Losing the introduction server does not matter once connected; only the data connection counts.
    if (!dataConnection.open) {
      handleClose()
    }
  })

  return {
    send: (message) => {
      if (!closed) {
        dataConnection.send(message)
      }
    },
    onMessage: (listener) => {
      listeners.add(listener)
      waiting.splice(0).forEach((message) => listener(message))

      return () => listeners.delete(listener)
    },
    onClose: (listener) => {
      closeListeners.add(listener)

      return () => closeListeners.delete(listener)
    },
    close: () => {
      dataConnection.close()
      handleClose()
    },
  }
}

/** A room registered under its code, taking in each player who joins it, one after another. */
export interface Room {
  code: string
  /** Calls `listener` with each player who connects. Returns a function that stops listening. */
  onConnection: (listener: (connection: Connection) => void) => () => void
  /** Gives the code up. */
  close: () => void
}

/** The code is held by someone else, often the other player who has not timed out yet. */
export class RoomTakenError extends Error {}

/** Registers the room under `code`, so players joining with that code reach this browser. */
export function claimRoom(code: string): Promise<Room> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(ID_PREFIX + code)
    const listeners = new Set<(connection: Connection) => void>()
    let opened = false

    peer.on('open', () => {
      opened = true
      resolve({
        code,
        onConnection: (listener) => {
          listeners.add(listener)

          return () => listeners.delete(listener)
        },
        close: () => peer.destroy(),
      })
    })

    peer.on('connection', (dataConnection) => {
      dataConnection.on('open', () => {
        const connection = wrap(dataConnection, null)
        listeners.forEach((listener) => listener(connection))
      })
    })

    // Players already connected keep playing without the introduction server; reconnecting lets new ones in again.
    peer.on('disconnected', () => {
      if (!peer.destroyed) {
        peer.reconnect()
      }
    })

    peer.on('error', (error) => {
      if (opened) {
        return
      }

      peer.destroy()
      reject(error.type === 'unavailable-id' ? new RoomTakenError(`Room ${code} is taken`) : new Error(NETWORK_ERROR))
    })
  })
}

/** Registers a room under a new code. Tries a few codes in case one is taken. */
export async function hostRoom(): Promise<Room> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await claimRoom(newRoomCode())
    } catch (error) {
      if (!(error instanceof RoomTakenError) || attempt >= HOST_ATTEMPTS) {
        throw error
      }
    }
  }
}

/** Nobody holds the room: the game ended, or its holder dropped and the code is free to take over. */
export class NoRoomError extends Error {}

/** Joins the room with this code. */
export function joinRoom(code: string, timeout = JOIN_TIMEOUT_MS): Promise<Connection> {
  return new Promise((resolve, reject) => {
    const peer = new Peer()
    const fail = (error: Error) => {
      clearTimeout(timer)
      peer.destroy()
      reject(error)
    }
    const timer = setTimeout(() => fail(new NoRoomError(`No game found with code ${code}.`)), timeout)

    peer.on('open', () => {
      const dataConnection = peer.connect(ID_PREFIX + code, { reliable: true })
      dataConnection.on('open', () => {
        clearTimeout(timer)
        resolve(wrap(dataConnection, peer))
      })
    })

    peer.on('error', (error) => {
      fail(error.type === 'peer-unavailable' ? new NoRoomError(`No game found with code ${code}.`) : new Error(NETWORK_ERROR))
    })
  })
}
