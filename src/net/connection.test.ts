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

  it('keeps messages sent before the other end listens, in order', () => {
    const [host, guest] = createLocalPair()
    host.send({ type: 'hello', version: 2 })
    host.send({ type: 'field', fieldSeed: 7 })
    const received: Message[] = []

    guest.onMessage((message) => received.push(message))

    expect(received).toEqual([
      { type: 'hello', version: 2 },
      { type: 'field', fieldSeed: 7 },
    ])
  })

  it('stops delivering once closed, and tells both ends', () => {
    const [host, guest] = createLocalPair()
    const received: Message[] = []
    let closings = 0
    guest.onMessage((message) => received.push(message))
    host.onClose(() => closings++)
    guest.onClose(() => closings++)

    host.close()
    host.send({ type: 'move', move: { type: 'wait' } })

    expect(received).toEqual([])
    expect(closings).toBe(2)
  })
})
