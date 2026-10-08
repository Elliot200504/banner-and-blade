export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="start-screen">
      <div className="start-screen__crest">⚔️</div>
      <h1 className="start-screen__title">Banner &amp; Blade</h1>
      <p className="start-screen__subtitle">A turn-based hex battle</p>

      <button className="button button--large" onClick={onStart} autoFocus>
        Hot-seat battle
      </button>
      <p className="start-screen__hint">Two players, one computer. Red vs Blue.</p>

      <section className="panel start-screen__rules">
        <h2 className="panel__title">How to play</h2>
        <ul>
          <li>Units act in order of initiative. The glowing unit is yours to command.</li>
          <li>Click a shaded hex to move. Click an enemy to attack it.</li>
          <li>🗡️ Swordsmen walk up and strike. Aim at the side of the enemy you want to attack from.</li>
          <li>🏹 Archers shoot anywhere, but at half damage with an enemy next to them.</li>
          <li>Enemies hit in melee strike back once per round.</li>
          <li>🛡️ Defend (D) to take less damage until your next turn.</li>
          <li>Destroy every enemy unit to win.</li>
        </ul>
      </section>
    </main>
  )
}
