import { useState } from 'react'
import type { Faction, Player } from './game'
import { Battle } from './ui/Battle'
import { StartScreen } from './ui/StartScreen'
import { ThemeToggle } from './ui/ThemeToggle'
import { useTheme } from './ui/useTheme'

const newSeed = () => Math.floor(Math.random() * 2 ** 32)

export default function App() {
  const [screen, setScreen] = useState<'start' | 'battle'>('start')
  const [factions, setFactions] = useState<Record<Player, Faction>>({ red: 'order', blue: 'undead' })
  const [seed, setSeed] = useState(newSeed)
  const [theme, setTheme] = useTheme()

  const startBattle = () => {
    setSeed(newSeed())
    setScreen('battle')
  }

  return (
    <>
      <header className="app-header">
        {screen === 'battle' && <span className="app-header__title">Banner &amp; Blade</span>}
        <ThemeToggle theme={theme} onChange={setTheme} />
      </header>
      {screen === 'start' ? (
        <StartScreen
          factions={factions}
          onChangeFaction={(player, faction) => setFactions((current) => ({ ...current, [player]: faction }))}
          onStart={startBattle}
        />
      ) : (
        <Battle
          key={seed}
          factions={factions}
          seed={seed}
          theme={theme}
          onPlayAgain={startBattle}
          onMainMenu={() => setScreen('start')}
        />
      )}
    </>
  )
}
