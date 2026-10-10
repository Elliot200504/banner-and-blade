import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalPair, type Connection } from './connection'
import { NoRoomError, RoomTakenError, type Room } from './peer'
import type { Message } from './protocol'
import { OnlineSession, type SessionLinks } from './session'

const CODE = 'ABCDE'

/** An in-page stand-in for the introduction server: rooms by code, and joins that reach them. */
function fakeServer(): SessionLinks {
  const rooms = new Map<string, (connection: Connection) => void>()

  return {
    claim: async (code) => {
      if (rooms.has(code)) {
        throw new RoomTakenError(code)
      }

      const listeners = new Set<(connection: Connection) => void>()
      rooms.set(code, (connection) => listeners.forEach((listener) => listener(connection)))
      const room: Room = {
        code,
        onConnection: (listener) => {
          listeners.add(listener)

          return () => listeners.delete(listener)
        },
        close: () => rooms.delete(code),
      }

      return room
    },
    join: async (code) => {
      const room = rooms.get(code)

      if (!room) {
        throw new NoRoomError(code)
      }

      const [joining, joined] = createLocalPair()
      room(joined)

      return joining
    },
  }
}

describe('online sessions', () => {
  let server: SessionLinks

  beforeEach(() => {
    vi.useFakeTimers()
    server = fakeServer()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const host = () => OnlineSession.host(server, () => server.claim(CODE))

  it('waits when the other player leaves, and lets anyone take their place with the code', async () => {
    const holder = await host()
    const first = await OnlineSession.join(CODE, server)
    expect(holder.status).toBe('connected')

    first.leave()
    expect(holder.status).toBe('waiting')

    let joins = 0
    holder.onJoin(() => joins++)
    const second = await OnlineSession.join(CODE, server)
    const received: Message[] = []
    second.onMessage((message) => received.push(message))
    holder.send({ type: 'start', seed: 7 })

    expect(holder.status).toBe('connected')
    expect(joins).toBe(1)
    expect(received).toEqual([{ type: 'start', seed: 7 }])
  })

  it('turns away a third player', async () => {
    const holder = await host()
    await OnlineSession.join(CODE, server)
    const third = await OnlineSession.join(CODE, server)
    const received: Message[] = []
    third.onMessage((message) => received.push(message))

    expect(received).toEqual([{ type: 'full' }])
    expect(holder.status).toBe('connected')
  })

  it('takes the room over when its holder leaves, so the holder can come back with the same code', async () => {
    const holder = await host()
    const guest = await OnlineSession.join(CODE, server)

    holder.leave()
    expect(guest.status).toBe('waiting')
    expect(guest.holdsRoom).toBe(false)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(guest.holdsRoom).toBe(true)

    const returning = await OnlineSession.join(CODE, server)
    expect(guest.status).toBe('connected')
    expect(returning.status).toBe('connected')
  })

  it('rejoins on its own when only the connection dropped and the holder is still there', async () => {
    const holder = await host()
    const guest = await OnlineSession.join(CODE, server)
    let joins = 0
    holder.onJoin(() => joins++)

    // Drop the link without either player leaving: the holder waits, the guest finds its way back.
    ;(guest as unknown as { connection: Connection }).connection.close()
    expect(holder.status).toBe('waiting')

    await vi.advanceTimersByTimeAsync(2_000)
    expect(guest.status).toBe('connected')
    expect(holder.status).toBe('connected')
    expect(joins).toBe(1)
  })
})
