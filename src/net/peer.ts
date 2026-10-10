import { Peer, type DataConnection } from 'peerjs'
import type { Connection } from './connection'
import type { Message } from './protocol'
import { newRoomCode } from './roomCode'

/**
 * Online play over WebRTC, browser to browser. PeerJS's free public server only introduces the two players;
 * the moves themselves go directly between them.
 */

/** Every room is registered under this prefix, so codes cannot clash with other PeerJS apps. */
const ID_PREFIX = 'banner-and-blade-'
const JOIN_TIMEOUT_MS = 15_000
const HOST_ATTEMPTS = 3

/** Wraps a PeerJS data connection in the game's Connection. Closing it also shuts the peer down. */
function wrap(dataConnection: DataConnection, peer: Peer): Connection {
  const listeners = new Set<(message: Message) => void>()
  const closeListeners = new Set<() => void>()
  // Messages can arrive before the game starts listening, right after connecting: they wait here.
  const waiting: Message[] = []
  let closed = false
  const handleClose = () => {
    if (!closed) {
      closed = true
      closeListeners.forEach((listener) => listener())
      peer.destroy()
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
  peer.on('disconnected', () => {
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

export interface HostedRoom {
  /** The code to give a friend. */
  code: string
  /** Resolves with the connection once a friend joins. */
  connected: Promise<Connection>
  /** Stops waiting and closes the room. */
  cancel: () => void
}

/** Registers a new room and waits for a friend. Tries a few codes in case one is taken. */
export async function hostRoom(): Promise<HostedRoom> {
  for (let attempt = 1; ; attempt++) {
    const code = newRoomCode()

    try {
      return await openRoom(code)
    } catch (error) {
      if (!(error instanceof RoomTakenError) || attempt >= HOST_ATTEMPTS) {
        throw error
      }
    }
  }
}

class RoomTakenError extends Error {}

function openRoom(code: string): Promise<HostedRoom> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(ID_PREFIX + code)
    let resolveConnected: (connection: Connection) => void = () => {}
    let rejectConnected: (error: Error) => void = () => {}
    const connected = new Promise<Connection>((resolveConnection, rejectConnection) => {
      resolveConnected = resolveConnection
      rejectConnected = rejectConnection
    })
    // Nobody may be waiting on it yet; a cancelled room must not surface as an unhandled error.
    connected.catch(() => {})

    peer.on('open', () => {
      resolve({
        code,
        connected,
        cancel: () => {
          rejectConnected(new Error('Cancelled'))
          peer.destroy()
        },
      })
    })

    peer.on('connection', (dataConnection) => {
      dataConnection.on('open', () => resolveConnected(wrap(dataConnection, peer)))
    })

    peer.on('error', (error) => {
      peer.destroy()

      if (error.type === 'unavailable-id') {
        reject(new RoomTakenError(`Room ${code} is taken`))
      } else {
        reject(new Error('Could not reach the online service. Check your connection and try again.'))
        rejectConnected(new Error('The room closed'))
      }
    })
  })
}

/** Joins a friend's room by its code. */
export function joinRoom(code: string): Promise<Connection> {
  return new Promise((resolve, reject) => {
    const peer = new Peer()
    const timer = setTimeout(() => {
      peer.destroy()
      reject(new Error(`No game found with code ${code}.`))
    }, JOIN_TIMEOUT_MS)
    const fail = (message: string) => {
      clearTimeout(timer)
      peer.destroy()
      reject(new Error(message))
    }

    peer.on('open', () => {
      const dataConnection = peer.connect(ID_PREFIX + code, { reliable: true })
      dataConnection.on('open', () => {
        clearTimeout(timer)
        resolve(wrap(dataConnection, peer))
      })
    })

    peer.on('error', (error) => {
      fail(
        error.type === 'peer-unavailable'
          ? `No game found with code ${code}.`
          : 'Could not reach the online service. Check your connection and try again.',
      )
    })
  })
}
