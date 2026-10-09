import { useState } from 'react'
import { heroesOf, standardArmy, type Army, type Difficulty, type Faction, type HeroId, type Player } from './game'
import { Battle } from './ui/Battle'
import { StartScreen, type Controller } from './ui/StartScreen'
import { ThemeToggle } from './ui/ThemeToggle'
import { useTheme } from './ui/useTheme'

const newSeed = () => Math.floor(Math.random() * 2 ** 32)

export default function App() {
  const [screen, setScreen] = useState<'start' | 'battle'>('start')
  const [factions, setFactions] = useState<Record<Player, Faction>>({ red: 'castle', blue: 'necropolis' })
  const [heroes, setHeroes] = useState<Record<Player, HeroId>>({ red: 'tyris', blue: 'vokial' })
  const [controllers, setControllers] = useState<Record<Player, Controller>>({ red: 'human', blue: 'computer' })
  const [difficulties, setDifficulties] = useState<Record<Player, Difficulty>>({ red: 'normal', blue: 'normal' })
  const [armies, setArmies] = useState<Record<Player, Army>>({ red: standardArmy('castle'), blue: standardArmy('necropolis') })
  const [seed, setSeed] = useState(newSeed)
  const [theme, setTheme] = useTheme()

  const startBattle = () => {
    setSeed(newSeed())
    setScreen('battle')
  }

  return (
    <div className="app">
      {screen === 'battle' && (
        <header className="app-header">
          <span className="app-header__title">Banner &amp; Blade</span>
          <button className="button button--secondary" onClick={() => setScreen('start')}>
            Main menu
          </button>
          <ThemeToggle theme={theme} onChange={setTheme} />
        </header>
      )}
      {screen === 'start' ? (
        <StartScreen
          factions={factions}
          controllers={controllers}
          heroes={heroes}
          difficulties={difficulties}
          armies={armies}
          onChangeFaction={(player, faction) => {
            setFactions((current) => ({ ...current, [player]: faction }))
            setHeroes((current) => ({ ...current, [player]: heroesOf(faction)[0] }))
            setArmies((current) => ({ ...current, [player]: standardArmy(faction) }))
          }}
          onChangeHero={(player, hero) => setHeroes((current) => ({ ...current, [player]: hero }))}
          onChangeController={(player, controller) => setControllers((current) => ({ ...current, [player]: controller }))}
          onChangeDifficulty={(player, difficulty) => setDifficulties((current) => ({ ...current, [player]: difficulty }))}
          onChangeArmy={(player, army) => setArmies((current) => ({ ...current, [player]: army }))}
          onStart={startBattle}
          themeToggle={<ThemeToggle theme={theme} onChange={setTheme} />}
        />
      ) : (
        <Battle
          key={seed}
          factions={factions}
          controllers={controllers}
          difficulties={difficulties}
          heroes={heroes}
          armies={armies}
          seed={seed}
          theme={theme}
          onPlayAgain={startBattle}
          onMainMenu={() => setScreen('start')}
        />
      )}
    </div>
  )
}
