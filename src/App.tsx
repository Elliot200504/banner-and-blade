import { useEffect, useState, type AnimationEvent } from 'react'
import { FACTION_ORDER, heroesOf, sizedArmy, standardArmy, type Army, type ArmySize, type Difficulty, type Faction, type HeroId, type Player } from './game'
import { About, GitHubLink } from './ui/modals/About'
import { Backdrop } from './ui/board/Backdrop'
import { Battle } from './ui/screens/Battle'
import { BattleCall } from './ui/screens/BattleCall'
import { Modal } from './ui/modals/Modal'
import { NEW_SETUP, StartScreen, type Controller, type SetupProgress } from './ui/screens/StartScreen'
import { playMusic } from './ui/audio/music'
import { Settings } from './ui/modals/Settings'
import { playSound } from './ui/audio/sound'
import { useSoundSettings } from './ui/audio/useSoundSettings'
import { useTheme } from './ui/hooks/useTheme'
import { showsBattle, type Screen } from './ui/screens/screen'

const newSeed = () => Math.floor(Math.random() * 2 ** 32)

const randomItem = <Item,>(items: Item[]): Item => items[Math.floor(Math.random() * items.length)]

export default function App() {
  const [screen, setScreen] = useState<Screen>('start')
  const [factions, setFactions] = useState<Record<Player, Faction>>({ red: 'castle', blue: 'necropolis' })
  const [heroes, setHeroes] = useState<Record<Player, HeroId>>({ red: 'tyris', blue: 'vokial' })
  const [controllers, setControllers] = useState<Record<Player, Controller>>({ red: 'human', blue: 'computer' })
  const [difficulties, setDifficulties] = useState<Record<Player, Difficulty>>({ red: 'normal', blue: 'normal' })
  const [armies, setArmies] = useState<Record<Player, Army>>({ red: standardArmy('castle'), blue: standardArmy('necropolis') })
  const [armySizes, setArmySizes] = useState<Record<Player, ArmySize>>({ red: 'small', blue: 'small' })
  const [fieldSeed, setFieldSeed] = useState(newSeed)
  const [seed, setSeed] = useState(newSeed)
  // Kept here so that coming back from a battle does not mean clicking through the setup again.
  const [setup, setSetup] = useState<SetupProgress>(NEW_SETUP)
  const [theme, setTheme] = useTheme()
  const [sound, setSound] = useSoundSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  // Each theme has a calm song for the menu and a tense one for battle.
  useEffect(() => {
    const menu = screen === 'start' || screen === 'to-menu'

    playMusic(sound.musicEnabled ? `${theme}:${menu ? 'menu' : 'battle'}` : null)
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

  // A horn sounds as the banner unrolls.
  useEffect(() => {
    if (screen !== 'to-battle') {
      return
    }

    const timer = setTimeout(() => playSound('horn'), 550)

    return () => clearTimeout(timer)
  }, [screen])

  // Any click or key during a zoom skips to its end. It is swallowed, so it cannot also act on the battle.
  useEffect(() => {
    if (screen === 'start' || screen === 'battle') {
      return
    }

    const skip = (event: Event) => {
      event.stopPropagation()
      event.preventDefault()
      setScreen((current) => (current === 'to-menu' ? 'start' : 'battle'))
    }
    window.addEventListener('click', skip, { capture: true })
    window.addEventListener('keydown', skip, { capture: true })

    return () => {
      window.removeEventListener('click', skip, { capture: true })
      window.removeEventListener('keydown', skip, { capture: true })
    }
  }, [screen])

  // Each step of a zoom ends with its own animation, which moves on to the next step.
  const handleAnimationEnd = (event: AnimationEvent) => {
    if (event.animationName === 'menu-leave' && screen === 'leaving') {
      setScreen('to-battle')
    } else if (event.animationName === 'battle-call' && screen === 'to-battle') {
      setScreen('battle')
    } else if (event.animationName === 'field-to-menu' && screen === 'to-menu') {
      setScreen('start')
    }
  }

  // The battle is fought on the field the menu shows, with fresh dice.
  const startBattle = () => {
    setSeed(newSeed())
    setScreen('leaving')
  }

  // Straight into a new battle, on a new field: no zoom.
  const playAgain = () => {
    setFieldSeed(newSeed())
    setSeed(newSeed())
  }

  return (
    <div className={`app app--${screen}`} onAnimationEnd={handleAnimationEnd}>
      <Backdrop screen={screen} theme={theme} fieldSeed={fieldSeed} factions={factions} heroes={heroes} armies={armies} />
      {showsBattle(screen) && (
        <header className="app-header">
          <span className="app-header__title">Banner &amp; Blade</span>
          <button className="button button--secondary" onClick={() => setScreen('to-menu')}>
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
      {!showsBattle(screen) ? (
        <StartScreen
          factions={factions}
          controllers={controllers}
          heroes={heroes}
          difficulties={difficulties}
          armies={armies}
          armySizes={armySizes}
          setup={setup}
          onChangeSetup={setSetup}
          onChangeFaction={(player, faction) => {
            setFactions((current) => ({ ...current, [player]: faction }))
            setHeroes((current) => ({ ...current, [player]: heroesOf(faction)[0] }))
            setArmies((current) => ({ ...current, [player]: sizedArmy(faction, armySizes[player]) }))
          }}
          onChangeHero={(player, hero) => setHeroes((current) => ({ ...current, [player]: hero }))}
          onChangeController={(player, controller) => setControllers((current) => ({ ...current, [player]: controller }))}
          onChangeDifficulty={(player, difficulty) => setDifficulties((current) => ({ ...current, [player]: difficulty }))}
          onChangeArmy={(player, army) => setArmies((current) => ({ ...current, [player]: army }))}
          onChangeArmySize={(player, size) => {
            // A new size brings that size's standard army with it.
            setArmySizes((current) => ({ ...current, [player]: size }))
            setArmies((current) => ({ ...current, [player]: sizedArmy(factions[player], size) }))
          }}
          onRandomSide={(player, size) => {
            const faction = randomItem(FACTION_ORDER)
            setFactions((current) => ({ ...current, [player]: faction }))
            setHeroes((current) => ({ ...current, [player]: randomItem(heroesOf(faction)) }))
            setArmySizes((current) => ({ ...current, [player]: size }))
            setArmies((current) => ({ ...current, [player]: sizedArmy(faction, size) }))
          }}
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
          fieldSeed={fieldSeed}
          seed={seed}
          theme={theme}
          paused={settingsOpen || aboutOpen || screen !== 'battle'}
          onPlayAgain={playAgain}
          onMainMenu={() => setScreen('to-menu')}
        />
      )}
      {screen === 'to-battle' && <BattleCall />}
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
