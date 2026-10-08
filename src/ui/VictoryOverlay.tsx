import { PLAYER_NAMES, type Player } from '../game'

interface VictoryOverlayProps {
  winner: Player
  round: number
  onPlayAgain: () => void
  onMainMenu: () => void
}

export function VictoryOverlay({ winner, round, onPlayAgain, onMainMenu }: VictoryOverlayProps) {
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className={`overlay__card overlay__card--${winner}`}>
        <div className="overlay__banner">🏆</div>
        <h2 className="overlay__title">{PLAYER_NAMES[winner]} wins!</h2>
        <p className="overlay__text">The battle was decided in round {round}.</p>
        <div className="overlay__buttons">
          <button className="button" onClick={onPlayAgain} autoFocus>
            Play again
          </button>
          <button className="button button--secondary" onClick={onMainMenu}>
            Main menu
          </button>
        </div>
      </div>
    </div>
  )
}
