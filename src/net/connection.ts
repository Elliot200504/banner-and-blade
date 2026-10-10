import type { Message } from './protocol'

/** A link to the other player, over a peer-to-peer connection or, in tests, within the same page. */
export interface Connection {
  send: (message: Message) => void
  /** Calls `listener` for every message from the other player. Returns a function that stops listening. */
  onMessage: (listener: (message: Message) => void) => () => void
  /** Calls `listener` once if the link drops or either side closes it. Returns a function that stops listening. */
  onClose: (listener: () => void) => () => void
  close: () => void
}

/** Two connected ends in the same page, for tests and local development. */
export function createLocalPair(): [Connection, Connection] {
  const listeners: [Set<(message: Message) => void>, Set<(message: Message) => void>] = [new Set(), new Set()]
  const closeListeners: [Set<() => void>, Set<() => void>] = [new Set(), new Set()]
  let open = true

  // Like a real connection, messages sent before the other end listens wait for it.
  const waiting: [Message[], Message[]] = [[], []]

  const end = (own: number): Connection => ({
    send: (message) => {
      if (!open) {
        return
      }

      if (listeners[1 - own].size === 0) {
        waiting[1 - own].push(message)
      } else {
        listeners[1 - own].forEach((listener) => listener(message))
      }
    },
    onMessage: (listener) => {
      listeners[own].add(listener)
      waiting[own].splice(0).forEach((message) => listener(message))

      return () => listeners[own].delete(listener)
    },
    onClose: (listener) => {
      closeListeners[own].add(listener)

      return () => closeListeners[own].delete(listener)
    },
    close: () => {
      if (open) {
        open = false
        closeListeners.forEach((side) => side.forEach((listener) => listener()))
      }
    },
  })

  return [end(0), end(1)]
}
