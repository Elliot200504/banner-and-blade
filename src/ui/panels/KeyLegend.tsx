interface KeyLegendProps {
  /** Whether it is the player's turn, so the keys do something right now. */
  canAct: boolean
  /** A spell is waiting for its target, so Escape cancels it. */
  aiming: boolean
}

const KEYS = [
  { key: 'W', action: 'Wait' },
  { key: 'D', action: 'Defend' },
  { key: 'C', action: 'Spells' },
] as const

/** The battle's keyboard shortcuts, in the corner of the field where they are easy to find. */
export function KeyLegend({ canAct, aiming }: KeyLegendProps) {
  return (
    <ul className={`key-legend${canAct ? '' : ' key-legend--idle'}`} aria-label="Keyboard shortcuts">
      {KEYS.map(({ key, action }) => (
        <li key={key} className="key-legend__item">
          <kbd className="key-legend__key">{key}</kbd>
          {action}
        </li>
      ))}
      <li className={`key-legend__item${aiming ? '' : ' key-legend__item--idle'}`}>
        <kbd className="key-legend__key">Esc</kbd>
        Cancel
      </li>
    </ul>
  )
}
