import { CREATURES, FACTIONS, PLAYER_NAMES, type GameState, type Player } from '../game'
import { SpriteIcon } from './SpriteImage'

interface ResultOverlayProps {
  state: GameState
  onPlayAgain: () => void
  onMainMenu: () => void
}

export function ResultOverlay({ state, onPlayAgain, onMainMenu }: ResultOverlayProps) {
  const winner = state.winner!

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className={`overlay__card result result--${winner}`}>
        <div className="result__banner">🏆</div>
        <h2 className="result__title">{PLAYER_NAMES[winner]} wins!</h2>
        <p className="result__text">
          {state.retreated
            ? `${PLAYER_NAMES[state.retreated]} retreated in round ${state.round}.`
            : `The battle was decided in round ${state.round}.`}
        </p>
        <div className="result__casualties">
          <Casualties state={state} player="red" />
          <Casualties state={state} player="blue" />
        </div>
        <div className="result__buttons">
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

function Casualties({ state, player }: { state: GameState; player: Player }) {
  const losses = FACTIONS[state.factions[player]].creatures
    .map((type) => ({ type, lost: state.casualties[player][type] ?? 0 }))
    .filter((loss) => loss.lost > 0)

  return (
    <section className={`result__side result__side--${player}`}>
      <h3 className="result__side-title">{PLAYER_NAMES[player]} losses</h3>
      {losses.length === 0 ? (
        <p className="result__none">None</p>
      ) : (
        <ul className="result__losses">
          {losses.map((loss) => (
            <li key={loss.type} title={CREATURES[loss.type].plural}>
              <SpriteIcon spriteId={loss.type} owner={player} size={32} mirrored={player === 'blue'} />
              <span>{loss.lost}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
