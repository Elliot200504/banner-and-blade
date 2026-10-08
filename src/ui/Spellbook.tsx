import { SPELL_ORDER, SPELLS, type Hero, type SpellId } from '../game'
import { Modal } from './Modal'

interface SpellbookProps {
  hero: Hero
  onChoose: (spell: SpellId) => void
  onClose: () => void
}

export function Spellbook({ hero, onChoose, onClose }: SpellbookProps) {
  return (
    <Modal title={`${hero.name}'s spellbook`} onClose={onClose} className="spellbook">
      <p className="spellbook__mana">
        Mana {hero.mana}/{hero.maxMana} · Spell power {hero.spellPower}
        {hero.hasCastThisRound && ' · Already cast this round'}
      </p>
      <div className="spellbook__grid">
        {SPELL_ORDER.map((spell) => {
          const definition = SPELLS[spell]
          const disabled = hero.hasCastThisRound || hero.mana < definition.cost
          return (
            <button key={spell} className="spell" disabled={disabled} onClick={() => onChoose(spell)}>
              <span className="spell__icon">{definition.icon}</span>
              <span className="spell__name">{definition.name}</span>
              <span className="spell__cost">{definition.cost} mana</span>
              <span className="spell__description">{definition.description}</span>
              <span className="spell__target">Target: {definition.target === 'enemy' ? 'enemy' : 'ally'}</span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
