import { isSpellSpecialist, SPELLS, type Hero, type SpellId } from '../../game'
import { Modal } from './Modal'
import { Icon, SpellIcon } from '../art/SpriteImage'

interface SpellbookProps {
  hero: Hero
  onChoose: (spell: SpellId) => void
  onClose: () => void
}

const TARGET_TEXT = { enemy: 'enemy', ally: 'ally', everyone: 'the whole field, no aiming' } as const

export function Spellbook({ hero, onChoose, onClose }: SpellbookProps) {
  return (
    <Modal title={`${hero.name}'s spellbook`} onClose={onClose} className="spellbook">
      <p className="spellbook__mana">
        Mana {hero.mana}/{hero.maxMana} · Spell power {hero.spellPower}
        {hero.hasCastThisRound && ' · Already cast this round'}
      </p>
      <div className="spellbook__grid">
        {hero.spells.map((spell) => {
          const definition = SPELLS[spell]
          const disabled = hero.hasCastThisRound || hero.mana < definition.cost

          return (
            <button key={spell} className="spell" disabled={disabled} onClick={() => onChoose(spell)}>
              <span className="spell__icon">
                <SpellIcon spell={spell} size={32} />
              </span>
              <span className="spell__name">
                {definition.name}
                {isSpellSpecialist(hero, spell) && (
                  <>
                    {' '}
                    <Icon name="star" label="Specialty" />
                  </>
                )}
              </span>
              <span className="spell__cost">{definition.cost} mana</span>
              <span className="spell__description">{definition.description}</span>
              <span className="spell__target">Target: {TARGET_TEXT[definition.target]}</span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
