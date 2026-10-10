import { useEffect, useRef, useState, type AnimationEvent } from 'react'
import {
  heroesOf,
  opponentOf,
  rollRandomSide,
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
import { PROTOCOL_VERSION, type GameSync, type SidePicksMessage } from './net/protocol'
import type { OnlineSession, SessionStatus } from './net/session'
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

/**
 * A game against a friend online. Whoever holds the room starts the battles and catches up anyone who joins.
 * `side` is null for a player who has just joined, until the catch-up says which side they take.
 */
interface OnlineGame {
  session: OnlineSession
  side: Player | null
  status: SessionStatus
  holdsRoom: boolean
}

const PLAYERS: Player[] = ['red', 'blue']

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
  /** Moves made before joining a battle under way, which it replays to catch up. */
  const [startingMoves, setStartingMoves] = useState<Move[]>([])
  /** Changes whenever a battle has to be built afresh, even with the same dice: a new battle, or a catch-up. */
  const [battleKey, setBattleKey] = useState(0)
  /** Every move of the current battle, to catch up a player joining it. */
  const battleMoves = useRef<Move[]>([])
  const screenRef = useRef(screen)
  screenRef.current = screen
  // The latest picks, for listeners set up once per online game.
  const latest = useRef({ setup, factions, heroes, armies, armySizes, fieldSeed, seed })
  latest.current = { setup, factions, heroes, armies, armySizes, fieldSeed, seed }
  const onlineRef = useRef(online)
  onlineRef.current = online

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

  /** Sides picked at random get their town, hero and army now, rolled from the battle's dice. */
  const rollRandomSides = (battleSeed: number, randomSides: Record<Player, boolean>, sizes: Record<Player, ArmySize>) => {
    for (const player of PLAYERS) {
      if (randomSides[player]) {
        const rolled = rollRandomSide(battleSeed, player, sizes[player])
        setFactions((current) => ({ ...current, [player]: rolled.faction }))
        setHeroes((current) => ({ ...current, [player]: rolled.hero }))
        setArmies((current) => ({ ...current, [player]: rolled.army }))
      }
    }
  }

  // The battle is fought on the field the menu shows, with fresh dice. Online, the room holder rolls them for both.
  const beginBattle = (battleSeed: number) => {
    const { setup: currentSetup, armySizes: currentSizes } = latest.current
    rollRandomSides(battleSeed, { red: currentSetup.red.random, blue: currentSetup.blue.random }, currentSizes)
    battleMoves.current = []
    setRemoteMoves([])
    setStartingMoves([])
    setBattleKey((current) => current + 1)
    setSeed(battleSeed)
    setScreen('leaving')
  }

  const startBattle = () => {
    const battleSeed = newSeed()
    online?.session.send({ type: 'start', seed: battleSeed })
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

  /** Leaves for good; the friend's game waits for someone to take this place. */
  const leaveOnline = () => {
    if (online) {
      online.session.leave()
      endOnline(null)
    }
  }

  /** What a side has picked, as the friend sees it: only the army size for a side picked at random. */
  const picksOf = (player: Player): SidePicksMessage | null => {
    const current = latest.current

    if (!current.setup[player].hero) {
      return null
    }

    if (current.setup[player].random) {
      return { random: true, armySize: current.armySizes[player] }
    }

    return {
      random: false,
      faction: current.factions[player],
      hero: current.heroes[player],
      army: current.armies[player],
      armySize: current.armySizes[player],
    }
  }

  const applyPicks = (player: Player, picks: SidePicksMessage | null) => {
    if (picks && !picks.random) {
      setFactions((current) => ({ ...current, [player]: picks.faction }))
      setHeroes((current) => ({ ...current, [player]: picks.hero }))
      setArmies((current) => ({ ...current, [player]: picks.army }))
    }

    if (picks) {
      setArmySizes((current) => ({ ...current, [player]: picks.armySize }))
    }

    setSetup((current) => ({
      ...current,
      [player]: { controller: true, difficulty: false, town: picks !== null, hero: picks !== null, random: picks?.random ?? false },
    }))
  }

  /** The whole game so far, for a player joining this browser's room. */
  const syncFor = (side: Player): GameSync => {
    const inBattle = screenRef.current !== 'start'

    return {
      side,
      fieldSeed: latest.current.fieldSeed,
      picks: { red: picksOf('red'), blue: picksOf('blue') },
      battle: inBattle ? { seed: latest.current.seed, moves: [...battleMoves.current] } : null,
    }
  }

  /** Catches up with the room holder's game: the side to play, both sides' picks and any battle under way. */
  const applySync = (sync: GameSync) => {
    const opponent = opponentOf(sync.side)
    setOnline((current) => current && { ...current, side: sync.side })
    setControllers({ [sync.side]: 'human', [opponent]: 'remote' } as Record<Player, Controller>)
    setFieldSeed(sync.fieldSeed)
    PLAYERS.forEach((player) => applyPicks(player, sync.picks[player]))

    if (sync.battle) {
      const sizes = { ...latest.current.armySizes }
      PLAYERS.forEach((player) => {
        const picks = sync.picks[player]

        if (picks) {
          sizes[player] = picks.armySize
        }
      })
      rollRandomSides(sync.battle.seed, { red: sync.picks.red?.random ?? false, blue: sync.picks.blue?.random ?? false }, sizes)
      battleMoves.current = [...sync.battle.moves]
      setStartingMoves(sync.battle.moves)
      setRemoteMoves([])
      setBattleKey((current) => current + 1)
      setSeed(sync.battle.seed)
      setScreen('battle')
    } else if (screenRef.current !== 'start') {
      setScreen('to-menu')
    }
  }

  /** Catches up whoever just joined this browser's room, giving them the side opposite this one. */
  const welcome = (session: OnlineSession, side: Player) => {
    session.send({ type: 'hello', version: PROTOCOL_VERSION })
    session.send({ type: 'sync', sync: syncFor(opponentOf(side)) })
  }

  const startOnline = (session: OnlineSession) => {
    setLobbyOpen(false)

    if (session.holdsRoom) {
      // The host plays Red and keeps the picks made so far; the friend's side fills in as they choose.
      setOnline({ session, side: 'red', status: session.status, holdsRoom: true })
      setControllers({ red: 'human', blue: 'remote' })
      setSetup((current) => ({
        red: { ...current.red, controller: true },
        blue: { controller: true, difficulty: false, town: false, hero: false, random: false },
      }))
      welcome(session, 'red')
    } else {
      setOnline({ session, side: null, status: session.status, holdsRoom: false })
    }
  }

  // Everything from the friend: their version, the catch-up, their picks, the start and their moves.
  const session = online?.session
  useEffect(() => {
    if (!session) {
      return
    }

    const stopMessages = session.onMessage((message) => {
      if (message.type === 'hello' && message.version !== PROTOCOL_VERSION) {
        session.close()
        endOnline('Your friend is running a different version of the game. Both of you need to reload the page.')
      } else if (message.type === 'sync') {
        applySync(message.sync)
      } else if (message.type === 'picks') {
        const side = onlineRef.current?.side

        if (side) {
          applyPicks(opponentOf(side), message.picks)
        }
      } else if (message.type === 'start') {
        beginBattle(message.seed)
      } else if (message.type === 'move') {
        setRemoteMoves((current) => [...current, message.move])
      } else if (message.type === 'full') {
        session.close()
        endOnline('That game already has two players.')
      }
    })
    // The friend leaving or dropping pauses the game; whoever joins next is caught up.
    const stopChanges = session.onChange(() =>
      setOnline((current) => current && { ...current, status: session.status, holdsRoom: session.holdsRoom }),
    )
    const stopJoins = session.onJoin(() => {
      const side = onlineRef.current?.side

      if (side) {
        welcome(session, side)
      }
    })

    return () => {
      stopMessages()
      stopChanges()
      stopJoins()
    }
    // The handlers only use state setters and refs, so the listeners need no other dependencies.
  }, [session])

  // This side's picks go to the friend whenever they change, once a hero is chosen.
  const localSide = online?.side ?? null
  const connected = online?.status === 'connected'
  // Compared as text, so the effect only runs when the picks really change.
  const localPicks = localSide ? JSON.stringify(picksOf(localSide)) : null
  useEffect(() => {
    if (session && connected && localSide && localPicks && localPicks !== 'null') {
      session.send({ type: 'picks', picks: JSON.parse(localPicks) as SidePicksMessage })
    }
  }, [session, connected, localSide, localPicks])

  // Straight into a new battle, on a new field: no zoom.
  const playAgain = () => {
    setFieldSeed(newSeed())
    setSeed(newSeed())
  }

  return (
    <div className={`app app--${screen}`} onAnimationEnd={handleAnimationEnd}>
      <Backdrop
        screen={screen}
        theme={theme}
        fieldSeed={fieldSeed}
        factions={factions}
        heroes={heroes}
        armies={armies}
        secret={{ red: setup.red.random, blue: setup.blue.random }}
      />
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
          onRandomSide={(player, size) => setArmySizes((current) => ({ ...current, [player]: size }))}
          onStart={startBattle}
          onOpenSettings={() => setSettingsOpen(true)}
          online={
            online?.side ? { side: online.side, isHost: online.holdsRoom && online.status === 'connected' } : null
          }
          onOpenOnline={() => setLobbyOpen(true)}
          onLeaveOnline={leaveOnline}
        />
      ) : (
        <Battle
          key={battleKey}
          factions={factions}
          controllers={controllers}
          difficulties={difficulties}
          heroes={heroes}
          armies={armies}
          fieldSeed={fieldSeed}
          seed={seed}
          theme={theme}
          paused={settingsOpen || aboutOpen || screen !== 'battle' || online?.status === 'waiting'}
          onPlayAgain={online ? () => setScreen('to-menu') : playAgain}
          onMainMenu={() => setScreen('to-menu')}
          connection={online?.session}
          remoteMoves={remoteMoves}
          startingMoves={startingMoves}
          onMove={(move) => battleMoves.current.push(move)}
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
      {online?.status === 'waiting' && online.side && (
        <Modal title="Waiting for your friend">
          <p className="modal__text">Your friend is gone, so the game is paused. It carries on as soon as someone joins with this code.</p>
          <p className="online__code" aria-label="Room code">
            {online.session.code}
          </p>
          <div className="modal__buttons">
            <button
              className="button button--secondary"
              onClick={() => {
                online.session.close()
                endOnline(null)
              }}
            >
              End online game
            </button>
          </div>
        </Modal>
      )}
      {onlineNotice && (
        <Modal title="Online game over" onClose={() => setOnlineNotice(null)}>
          <p className="modal__text">{onlineNotice}</p>
        </Modal>
      )}
    </div>
  )
}
