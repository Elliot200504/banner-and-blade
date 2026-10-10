import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createBattle, type Army, type Faction, type HeroId, type Player } from '../../game'
import wornTable from '../../assets/backgrounds/wood_table_worn.webp'
import { Board, type BoardHighlights, type DisplayUnit } from './Board'
import { BOARD_HEIGHT, BOARD_WIDTH, hexToPixel } from './layout'
import type { Theme } from '../hooks/useTheme'
import type { Screen } from '../screens/screen'

const NOTHING_HIGHLIGHTED: BoardHighlights = {
  activeUnitId: null,
  reachable: new Set(),
  inRange: new Set(),
  pathPreview: [],
  attackOrigin: null,
  targetUnitIds: new Set(),
  spellTargetIds: new Set(),
  spotlightUnitId: null,
  hoveredHex: null,
  selectedHex: null,
}

/** Where the drawn board sits on screen: the board keeps its shape, so it is centred inside its element. */
function boardRect(element: Element) {
  const box = element.getBoundingClientRect()
  const ratio = BOARD_WIDTH / BOARD_HEIGHT
  const width = Math.min(box.width, box.height * ratio)
  const height = width / ratio

  return { left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2, width }
}

/** The move and scale that lay the menu's field exactly over the battle's board. */
interface Flight {
  x: number
  y: number
  scale: number
}

interface BackdropProps {
  screen: Screen
  theme: Theme
  /** The battlefield's seed, shared with the battle, so the zoom lands on the very same obstacles. */
  fieldSeed: number
  factions: Record<Player, Faction>
  heroes: Record<Player, HeroId>
  armies: Record<Player, Army>
}

/**
 * The picture behind everything. Behind the menu: the battlefield with both armies drawn up, as they are
 * being recruited. In battle the real board is the picture, so only the Default theme gets a backdrop there:
 * a worn war table (CC0 texture from Poly Haven, polyhaven.com). Between the two, the field zooms from
 * filling the screen down onto the battle's board, or back up.
 */
export function Backdrop({ screen, theme, fieldSeed, factions, heroes, armies }: BackdropProps) {
  const battle = useMemo(() => createBattle(factions, fieldSeed, heroes, armies), [factions, fieldSeed, heroes, armies])
  const fieldRef = useRef<HTMLDivElement>(null)
  const [flight, setFlight] = useState<Flight | null>(null)
  const zooming = screen === 'to-battle' || screen === 'to-menu'

  // Measured before the first paint of a zoom, while the field still sits in its resting place.
  useLayoutEffect(() => {
    const field = fieldRef.current
    const target = document.querySelector('.board-frame .board')

    if (!zooming || !field || !target) {
      setFlight(null)

      return
    }

    const fieldBox = field.getBoundingClientRect()
    const home = boardRect(field.querySelector('.board') ?? field)
    const destination = boardRect(target)
    const scale = destination.width / home.width

    // The field scales from its own top left corner, which carries the board inside it along.
    setFlight({
      x: destination.left - fieldBox.left - scale * (home.left - fieldBox.left),
      y: destination.top - fieldBox.top - scale * (home.top - fieldBox.top),
      scale,
    })
  }, [zooming])

  const texture =
    theme === 'default' ? (
      <div className="backdrop backdrop--texture" style={{ backgroundImage: `url(${wornTable})` }} aria-hidden="true" />
    ) : null

  if (screen === 'battle') {
    return texture
  }

  const units: DisplayUnit[] = battle.units.map((unit) => ({
    unit,
    point: hexToPixel(unit.position),
    count: unit.count,
    topHp: unit.topHp,
    hit: false,
    dying: false,
    glow: '',
  }))

  const flightStyle = flight
    ? { '--flight-x': `${flight.x}px`, '--flight-y': `${flight.y}px`, '--flight-scale': flight.scale }
    : {}
  // The menu leaving already starts lifting the dark; the zooms wait until the flight is measured.
  const zoomClass = screen === 'leaving' || (zooming && flight) ? ` backdrop--${screen}` : ''

  // The war table fades in under the landing field, or out from under the rising one.
  return (
    <>
      {zooming && texture}
      <div className={`backdrop backdrop--battlefield${zoomClass}`} aria-hidden="true">
        <div
          ref={fieldRef}
          className="backdrop__field"
          style={{ aspectRatio: `${BOARD_WIDTH} / ${BOARD_HEIGHT}`, ...flightStyle } as CSSProperties}
        >
          <Board
            units={units}
            obstacles={battle.obstacles}
            factions={battle.factions}
            heroes={heroes}
            highlights={NOTHING_HIGHLIGHTED}
            projectile={null}
            lightning={null}
            floatingTexts={[]}
            cursor="default"
            theme={theme}
            onPointerMove={() => {}}
            onBoardClick={() => {}}
            onBoardRightClick={() => {}}
          />
        </div>
      </div>
    </>
  )
}
