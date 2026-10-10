import { useLayoutEffect, useState, type CSSProperties } from 'react'

/**
 * The call to arms as the field lands on the board: the board's edges flare and a banner unrolls
 * across it with "To Battle!" on it. It covers the board only, measured before the first paint.
 */
export function BattleCall() {
  const [area, setArea] = useState<CSSProperties | null>(null)

  useLayoutEffect(() => {
    const board = document.querySelector('.board-frame')

    if (board) {
      const box = board.getBoundingClientRect()
      setArea({ left: box.left, top: box.top, width: box.width, height: box.height })
    }
  }, [])

  if (!area) {
    return null
  }

  return (
    <div className="battle-call" style={area} role="status">
      <div className="battle-call__glow" aria-hidden="true" />
      <div className="battle-call__band">
        <p className="battle-call__text">To Battle!</p>
      </div>
    </div>
  )
}
