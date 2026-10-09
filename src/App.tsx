import { useEffect, useState } from 'react'
import { heroesOf, standardArmy, type Army, type Difficulty, type Faction, type HeroId, type Player } from './game'
import { About, GitHubLink } from './ui/About'
import { Battle } from './ui/Battle'
import { Modal } from './ui/Modal'
import { StartScreen, type Controller } from './ui/StartScreen'
import { playMusic } from './ui/music'
import { Settings } from './ui/Settings'
import { playSound } from './ui/sound'
import { useSoundSettings } from './ui/useSoundSettings'
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
  const [sound, setSound] = useSoundSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  // Each theme has a calm song for the menu and a tense one for battle.
  useEffect(() => {
    playMusic(sound.musicEnabled ? `${theme}:${screen === 'start' ? 'menu' : 'battle'}` : null)
  }, [theme, screen, sound.musicEnabled])

  // Every enabled button clicks softly when pressed.
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest('button')

      if (button && !button.disabled) {
        playSound('click')
      }
    }
    document.addEventListener('click', handleClick)

    return () => document.removeEventListener('click', handleClick)
  }, [])

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
          <button className="button button--secondary" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
          <button className="button button--secondary" onClick={() => setAboutOpen(true)}>
            About
          </button>
          <GitHubLink />
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
          onOpenSettings={() => setSettingsOpen(true)}
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
          paused={settingsOpen || aboutOpen}
          onPlayAgain={startBattle}
          onMainMenu={() => setScreen('start')}
        />
      )}
      {settingsOpen && (
        <Settings
          theme={theme}
          onChangeTheme={setTheme}
          sound={sound}
          onChangeSound={setSound}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {aboutOpen && (
        <Modal title="About" onClose={() => setAboutOpen(false)} className="about">
          <About />
        </Modal>
      )}
    </div>
  )
}
