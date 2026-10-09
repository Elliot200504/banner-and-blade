import { useMemo } from 'react'
import { createBattle, type Army, type Faction, type HeroId, type Player } from '../../game'
import wornTable from '../../assets/backgrounds/wood_table_worn.webp'
import { Board, type BoardHighlights, type DisplayUnit } from './Board'
import { BOARD_HEIGHT, BOARD_WIDTH, hexToPixel } from './layout'
import type { Theme } from '../hooks/useTheme'

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

/** Fixed seed, so the field's obstacles only change when a town does. */
const BACKDROP_SEED = 20261009

interface BackdropProps {
  screen: 'start' | 'battle'
  theme: Theme
  factions: Record<Player, Faction>
  heroes: Record<Player, HeroId>
  armies: Record<Player, Army>
}

/**
 * The picture behind everything. Behind the menu: the battlefield with both armies drawn up, as they are
 * being recruited. In battle the real board is the picture, so only the Default theme gets a backdrop there:
 * a worn war table (CC0 texture from Poly Haven, polyhaven.com).
 */
export function Backdrop({ screen, theme, factions, heroes, armies }: BackdropProps) {
  const battle = useMemo(() => createBattle(factions, BACKDROP_SEED, heroes, armies), [factions, heroes, armies])

  if (screen === 'battle') {
    return theme === 'default' ? (
      <div className="backdrop backdrop--texture" style={{ backgroundImage: `url(${wornTable})` }} aria-hidden="true" />
    ) : null
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

  return (
    <div className="backdrop backdrop--battlefield" aria-hidden="true">
      <div className="backdrop__field" style={{ aspectRatio: `${BOARD_WIDTH} / ${BOARD_HEIGHT}` }}>
        <Board
          units={units}
          obstacles={battle.obstacles}
          factions={battle.factions}
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
  )
}
