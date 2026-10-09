import { describe, expect, it } from 'vitest'
import { createLocalPair } from './connection'
import type { Message } from './protocol'

describe('local connection pair', () => {
  it('delivers a move to the other end only', () => {
    const [host, guest] = createLocalPair()
    const received: Message[] = []
    const echoed: Message[] = []
    guest.onMessage((message) => received.push(message))
    host.onMessage((message) => echoed.push(message))

    host.send({ type: 'move', move: { type: 'defend' } })

    expect(received).toEqual([{ type: 'move', move: { type: 'defend' } }])
    expect(echoed).toEqual([])
  })

  it('stops delivering once closed', () => {
    const [host, guest] = createLocalPair()
    const received: Message[] = []
    guest.onMessage((message) => received.push(message))

    host.close()
    host.send({ type: 'move', move: { type: 'wait' } })

    expect(received).toEqual([])
  })
})
