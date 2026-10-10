import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Player } from '../../game'
import type { Connection } from '../../net/connection'
import { hostRoom, joinRoom, type HostedRoom } from '../../net/peer'
import { isRoomCode, normalizeRoomCode } from '../../net/roomCode'
import { Modal } from './Modal'

interface OnlineLobbyProps {
  /** A friend is connected: the host plays Red, the guest Blue. */
  onConnected: (connection: Connection, side: Player) => void
  onClose: () => void
}

type LobbyState =
  | { step: 'choose' }
  | { step: 'opening' }
  | { step: 'hosting'; code: string }
  | { step: 'joining'; code: string }

/** Host a game and share its code, or join a friend's game by typing theirs. */
export function OnlineLobby({ onConnected, onClose }: OnlineLobbyProps) {
  const [lobby, setLobby] = useState<LobbyState>({ step: 'choose' })
  const [typedCode, setTypedCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const room = useRef<HostedRoom | null>(null)
  const closed = useRef(false)

  // Closing the window while still waiting gives the room up.
  useEffect(() => {
    closed.current = false

    return () => {
      closed.current = true
      room.current?.cancel()
    }
  }, [])

  const host = async () => {
    setError(null)
    setLobby({ step: 'opening' })

    try {
      const hosted = await hostRoom()

      if (closed.current) {
        hosted.cancel()

        return
      }

      room.current = hosted
      setLobby({ step: 'hosting', code: hosted.code })
      const connection = await hosted.connected
      room.current = null

      if (!closed.current) {
        onConnected(connection, 'red')
      }
    } catch (caught) {
      if (!closed.current) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.')
        setLobby({ step: 'choose' })
      }
    }
  }

  const join = async (event: FormEvent) => {
    event.preventDefault()
    const code = normalizeRoomCode(typedCode)
    setError(null)
    setLobby({ step: 'joining', code })

    try {
      const connection = await joinRoom(code)

      if (closed.current) {
        connection.close()
      } else {
        onConnected(connection, 'blue')
      }
    } catch (caught) {
      if (!closed.current) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.')
        setLobby({ step: 'choose' })
      }
    }
  }

  const cancel = () => {
    room.current?.cancel()
    room.current = null
    setLobby({ step: 'choose' })
  }

  return (
    <Modal title="Play online" onClose={onClose} className="online">
      {lobby.step === 'choose' && (
        <div className="online__choices">
          <button className="button" onClick={host}>
            Host a game
          </button>
          <form className="online__join" onSubmit={join}>
            <input
              className="online__code-input"
              value={typedCode}
              onChange={(event) => setTypedCode(normalizeRoomCode(event.target.value).slice(0, 5))}
              placeholder="CODE"
              aria-label="Room code"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="button" type="submit" disabled={!isRoomCode(normalizeRoomCode(typedCode))}>
              Join
            </button>
          </form>
        </div>
      )}
      {lobby.step === 'opening' && <p className="modal__text">Opening a room…</p>}
      {lobby.step === 'hosting' && (
        <div className="online__hosting">
          <p className="online__code" aria-label="Room code">
            {lobby.code}
          </p>
          <p className="modal__text">Waiting for your friend to join…</p>
          <button className="button button--secondary" onClick={cancel}>
            Cancel
          </button>
        </div>
      )}
      {lobby.step === 'joining' && <p className="modal__text">Joining {lobby.code}…</p>}
      {error && <p className="online__error">{error}</p>}
    </Modal>
  )
}
