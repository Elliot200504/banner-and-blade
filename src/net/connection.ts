import type { Message } from './protocol'

/** A link to the other player. The transport behind it (WebRTC, a relay server…) is not decided yet. */
export interface Connection {
  send: (message: Message) => void
  /** Calls `listener` for every message from the other player. Returns a function that stops listening. */
  onMessage: (listener: (message: Message) => void) => () => void
  close: () => void
}

/** Two connected ends in the same page, for tests and local development. */
export function createLocalPair(): [Connection, Connection] {
  const listeners: [Set<(message: Message) => void>, Set<(message: Message) => void>] = [new Set(), new Set()]
  let open = true

  const end = (own: number): Connection => ({
    send: (message) => {
      if (open) {
        listeners[1 - own].forEach((listener) => listener(message))
      }
    },
    onMessage: (listener) => {
      listeners[own].add(listener)

      return () => listeners[own].delete(listener)
    },
    close: () => {
      open = false
    },
  })

  return [end(0), end(1)]
}
