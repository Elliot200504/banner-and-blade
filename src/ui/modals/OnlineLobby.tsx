import { useEffect, useRef, useState, type FormEvent } from 'react'
import { isRoomCode, normalizeRoomCode } from '../../net/roomCode'
import { OnlineSession } from '../../net/session'
import { Modal } from './Modal'

interface OnlineLobbyProps {
  /** A friend is connected. The host plays Red; a joining player learns their side from the host's catch-up. */
  onConnected: (session: OnlineSession) => void
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
  const room = useRef<OnlineSession | null>(null)
  const closed = useRef(false)

  // Closing the window while still waiting gives the room up.
  useEffect(() => {
    closed.current = false

    return () => {
      closed.current = true
      room.current?.close()
    }
  }, [])

  const host = async () => {
    setError(null)
    setLobby({ step: 'opening' })

    try {
      const session = await OnlineSession.host()

      if (closed.current) {
        session.close()

        return
      }

      room.current = session
      setLobby({ step: 'hosting', code: session.code })
      const stopWaiting = session.onChange(() => {
        if (session.status === 'connected') {
          stopWaiting()
          room.current = null
          onConnected(session)
        }
      })
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
      const session = await OnlineSession.join(code)

      if (closed.current) {
        session.close()
      } else {
        onConnected(session)
      }
    } catch (caught) {
      if (!closed.current) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.')
        setLobby({ step: 'choose' })
      }
    }
  }

  const cancel = () => {
    room.current?.close()
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
