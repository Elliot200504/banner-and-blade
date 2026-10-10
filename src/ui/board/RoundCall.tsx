interface RoundCallProps {
  round: number
}

/** "Round 2" and on, called out over the board as a new round begins. Keyed by round, so each one plays once. */
export function RoundCall({ round }: RoundCallProps) {
  return (
    <div className="round-call" role="status">
      <p className="round-call__text">Round {round}</p>
    </div>
  )
}
