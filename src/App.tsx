import { useEffect, useRef, useState, type AnimationEvent } from 'react'
import {
  heroesOf,
  opponentOf,
  sizedArmy,
  standardArmy,
  type Army,
  type ArmySize,
  type Difficulty,
  type Faction,
  type HeroId,
  type Move,
  type Player,
} from './game'
import type { Connection } from './net/connection'
import { PROTOCOL_VERSION } from './net/protocol'
import { About, GitHubLink } from './ui/modals/About'
import { Backdrop } from './ui/board/Backdrop'
import { Battle } from './ui/screens/Battle'
import { BattleCall } from './ui/screens/BattleCall'
import { Modal } from './ui/modals/Modal'
import { OnlineLobby } from './ui/modals/OnlineLobby'
import { NEW_SETUP, StartScreen, type Controller, type SetupProgress } from './ui/screens/StartScreen'
import { playMusic } from './ui/audio/music'
import { Settings } from './ui/modals/Settings'
import { playSound } from './ui/audio/sound'
import { useSoundSettings } from './ui/audio/useSoundSettings'
import { useTheme } from './ui/hooks/useTheme'
import { showsBattle, type Screen } from './ui/screens/screen'

const newSeed = () => Math.floor(Math.random() * 2 ** 32)

/** A game against a friend online. The host plays Red and starts the battles. */
interface OnlineGame {
  connection: Connection
  side: Player
  isHost: boolean
}

const OFFLINE_CONTROLLERS: Record<Player, Controller> = { red: 'human', blue: 'computer' }

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
  const [online, setOnline] = useState<OnlineGame | null>(null)
  const [lobbyOpen, setLobbyOpen] = useState(false)
  /** Why an online game ended, shown until dismissed. */
  const [onlineNotice, setOnlineNotice] = useState<string | null>(null)
  /** The other player's moves in the current battle, in the order they arrived. */
  const [remoteMoves, setRemoteMoves] = useState<Move[]>([])
  const screenRef = useRef(screen)
  screenRef.current = screen

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

  // The battle is fought on the field the menu shows, with fresh dice. Online, the host rolls them for both.
  const beginBattle = (battleSeed: number) => {
    setRemoteMoves([])
    setSeed(battleSeed)
    setScreen('leaving')
  }

  const startBattle = () => {
    const battleSeed = newSeed()
    online?.connection.send({ type: 'start', seed: battleSeed })
    beginBattle(battleSeed)
  }

  // Back to playing alone: the other side goes back to being the computer, still to be set up.
  const endOnline = (notice: string | null) => {
    setOnline(null)
    setOnlineNotice(notice)
    setControllers(OFFLINE_CONTROLLERS)
    setSetup((current) => ({ ...current, blue: { ...NEW_SETUP.blue } }))

    if (screenRef.current !== 'start' && screenRef.current !== 'leaving') {
      setScreen('to-menu')
    }
  }

  const leaveOnline = () => {
    if (online) {
      online.connection.send({ type: 'leave' })
      online.connection.close()
      endOnline(null)
    }
  }

  const startOnline = (connection: Connection, side: Player) => {
    const opponent = opponentOf(side)
    setLobbyOpen(false)
    setOnline({ connection, side, isHost: side === 'red' })
    setControllers({ [side]: 'human', [opponent]: 'remote' } as Record<Player, Controller>)
    // This side keeps its picks; the friend's side fills in as they choose.
    setSetup(
      (current) =>
        ({
          [side]: { ...current[side], controller: true },
          [opponent]: { controller: true, difficulty: false, town: false, hero: false },
        }) as SetupProgress,
    )
    connection.send({ type: 'hello', version: PROTOCOL_VERSION })

    if (side === 'red') {
      connection.send({ type: 'field', fieldSeed })
    }
  }

  // Everything the friend sends: their version, the shared field, their picks, the start and their moves.
  useEffect(() => {
    if (!online) {
      return
    }

    const opponent = opponentOf(online.side)
    const stopMessages = online.connection.onMessage((message) => {
      if (message.type === 'hello' && message.version !== PROTOCOL_VERSION) {
        online.connection.close()
        endOnline('Your friend is running a different version of the game. Both of you need to reload the page.')
      } else if (message.type === 'field') {
        setFieldSeed(message.fieldSeed)
      } else if (message.type === 'picks') {
        const { faction, hero, army, armySize } = message.picks
        setFactions((current) => ({ ...current, [opponent]: faction }))
        setHeroes((current) => ({ ...current, [opponent]: hero }))
        setArmies((current) => ({ ...current, [opponent]: army }))
        setArmySizes((current) => ({ ...current, [opponent]: armySize }))
        setSetup((current) => ({ ...current, [opponent]: { controller: true, difficulty: false, town: true, hero: true } }))
      } else if (message.type === 'start') {
        beginBattle(message.seed)
      } else if (message.type === 'move') {
        setRemoteMoves((current) => [...current, message.move])
      } else if (message.type === 'leave') {
        online.connection.close()
        endOnline('Your friend left the game.')
      }
    })
    const stopClose = online.connection.onClose(() => endOnline('The connection to your friend was lost.'))

    return () => {
      stopMessages()
      stopClose()
    }
    // endOnline and beginBattle only use state setters and refs, so the listeners need no other dependencies.
  }, [online])

  // This side's picks go to the friend whenever they change, once a hero is chosen.
  const localSide = online?.side
  const localPicksReady = localSide ? setup[localSide].hero : false
  const localFaction = localSide ? factions[localSide] : null
  const localHero = localSide ? heroes[localSide] : null
  const localArmy = localSide ? armies[localSide] : null
  const localArmySize = localSide ? armySizes[localSide] : null
  useEffect(() => {
    if (online && localPicksReady && localFaction && localHero && localArmy && localArmySize) {
      online.connection.send({
        type: 'picks',
        picks: { faction: localFaction, hero: localHero, army: localArmy, armySize: localArmySize },
      })
    }
  }, [online, localPicksReady, localFaction, localHero, localArmy, localArmySize])

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
          {/* Leaving an online battle midway ends the game for both players. */}
          <button className="button button--secondary" onClick={() => (online ? leaveOnline() : setScreen('to-menu'))}>
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
          onStart={startBattle}
          onOpenSettings={() => setSettingsOpen(true)}
          online={online && { side: online.side, isHost: online.isHost }}
          onOpenOnline={() => setLobbyOpen(true)}
          onLeaveOnline={leaveOnline}
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
          onPlayAgain={online ? () => setScreen('to-menu') : playAgain}
          onMainMenu={() => setScreen('to-menu')}
          connection={online?.connection}
          remoteMoves={remoteMoves}
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
      {lobbyOpen && <OnlineLobby onConnected={startOnline} onClose={() => setLobbyOpen(false)} />}
      {onlineNotice && (
        <Modal title="Online game over" onClose={() => setOnlineNotice(null)}>
          <p className="modal__text">{onlineNotice}</p>
        </Modal>
      )}
    </div>
  )
}
