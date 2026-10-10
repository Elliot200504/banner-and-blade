/** Hero spells: who can cast what on whom, who a spell hits, and what it does to them. */

import { afterDamage, totalHp } from '../combat'
import { CREATURES, hasAbility } from '../creatures'
import { isSpellSpecialist, type Hero } from '../heroes'
import { unitDistance } from '../movement'
import { animateDeadAmount, cureAmount, isEffect, OPPOSITE_EFFECT, SPELLS, spellDamage, type SpellId } from '../spells'
import type { GameState, Player, Unit } from '../types'
import { getUnit, recordLosses, updateUnit, type Draft } from './draft'
import { activeUnit } from './turnRules'
import { isImmune, MAGIC_RESISTANCE_CHANCE } from './unitRules'

/** Why the active player's hero can't cast this spell (on this stack), or null if they can. */
export function castProblem(state: GameState, spell: SpellId, targetId?: string): string | null {
  const actor = activeUnit(state)

  if (!actor || state.winner) {
    return 'The battle is over.'
  }

  const hero = state.heroes[actor.owner]
  const definition = SPELLS[spell]

  if (!hero.spells.includes(spell)) {
    return `${hero.name} does not know ${definition.name}.`
  }

  if (hero.hasCastThisRound) {
    return 'Your hero has already cast a spell this round.'
  }

  if (hero.mana < definition.cost) {
    return 'Not enough mana.'
  }

  if (definition.target === 'everyone') {
    return null
  }

  const target = state.units.find((unit) => unit.id === targetId)

  if (!target) {
    return 'No target.'
  }

  const wantsEnemy = definition.target === 'enemy'

  if (wantsEnemy !== (target.owner !== actor.owner)) {
    return wantsEnemy ? 'Target an enemy stack.' : 'Target one of your stacks.'
  }

  if (definition.undeadOnly && !hasAbility(target.type, 'undead')) {
    return `${definition.name} only works on the undead.`
  }

  if (isImmune(target, spell)) {
    return `${target.label} are immune to ${definition.name}.`
  }

  return null
}

/**
 * Every stack a spell would hit: the whole living field, the target and its surroundings, or just the target. Immune stacks are left out.
 * A Death Ripple specialist's ripple also reaches the enemy's undead, so it still works against Necropolis.
 */
export function spellVictims(
  units: Unit[],
  spell: SpellId,
  target: Unit | undefined,
  caster?: { owner: Player; hero: Pick<Hero, 'specialty'> },
): Unit[] {
  const affected = units.filter((unit) => !isImmune(unit, spell))

  if (spell === 'deathRipple') {
    const reachesUndead = (unit: Unit) =>
      caster !== undefined && isSpellSpecialist(caster.hero, spell) && unit.owner !== caster.owner

    return affected.filter((unit) => !hasAbility(unit.type, 'undead') || reachesUndead(unit))
  }

  if (!target) {
    return []
  }

  if (spell === 'meteorShower') {
    return affected.filter((unit) => unitDistance(unit, target) <= 1)
  }

  if (spell === 'inferno') {
    return affected.filter((unit) => unitDistance(unit, target) <= 2)
  }

  return [target]
}

/** Whether a magic-resistant stack shrugs off a hostile spell. Rolls only for enemies of the caster. */
function resists(draft: Draft, victim: Unit, caster: Player, spell: SpellId): boolean {
  if (victim.owner === caster || !hasAbility(victim.type, 'magicResistance')) {
    return false
  }

  if (!draft.random.chance(MAGIC_RESISTANCE_CHANCE)) {
    return false
  }

  draft.log.push(`${victim.label} resist ${SPELLS[spell].name}!`)

  return true
}

export function castSpell(draft: Draft, caster: Player, spell: SpellId, targetId: string | undefined) {
  const hero = draft.heroes[caster]
  const definition = SPELLS[spell]
  draft.heroes = { ...draft.heroes, [caster]: { ...hero, mana: hero.mana - definition.cost, hasCastThisRound: true } }
  const target = targetId === undefined ? undefined : getUnit(draft, targetId)
  draft.log.push(target ? `${hero.name} casts ${definition.name} on ${target.label}.` : `${hero.name} casts ${definition.name}.`)

  const damage = spellDamage(spell, hero)

  if (damage > 0) {
    for (const victim of spellVictims(draft.units, spell, target, { owner: caster, hero })) {
      if (resists(draft, victim, caster, spell)) {
        continue
      }

      const result = afterDamage(victim, damage)
      updateUnit(draft, victim.id, { count: result.count, topHp: result.topHp })
      recordLosses(draft, victim, result.kills)
      draft.events.push({
        kind: 'spell',
        spell,
        caster,
        targetId: victim.id,
        damage,
        kills: result.kills,
        targetCount: result.count,
        targetTopHp: result.topHp,
      })
      draft.log.push(`${victim.label} take ${damage} damage. ${result.kills} perish.`)

      if (result.count === 0) {
        draft.events.push({ kind: 'death', unitId: victim.id })
        draft.log.push(`${victim.label} are destroyed!`)
      }
    }

    return
  }

  if (!target) {
    return
  }

  if (resists(draft, target, caster, spell)) {
    // Shrugged off: the spell still flashes, but nothing changes.
  } else if (spell === 'cure') {
    const topHp = Math.min(CREATURES[target.type].hp, target.topHp + cureAmount(hero))
    const effects = target.effects.filter((active) => active.effect !== 'slow' && active.effect !== 'curse')
    updateUnit(draft, target.id, { topHp, effects, petrified: false, lostTurn: false })
  } else if (spell === 'animateDead') {
    // Heals the stack and raises its fallen, up to the size it started the battle with.
    const stats = CREATURES[target.type]
    const health = Math.min(target.startCount * stats.hp, totalHp(target) + animateDeadAmount(hero))
    const count = Math.max(target.count, Math.ceil(health / stats.hp))
    const raised = count - target.count
    updateUnit(draft, target.id, { count, topHp: health - (count - 1) * stats.hp })
    const losses = draft.casualties[target.owner]
    losses[target.type] = Math.max(0, (losses[target.type] ?? 0) - raised)

    if (raised > 0) {
      draft.log.push(`${raised} ${raised === 1 ? stats.name : stats.plural} rise again!`)
    }
  } else if (isEffect(spell)) {
    const opposite = OPPOSITE_EFFECT[spell]
    const effects = target.effects.filter((active) => active.effect !== spell && active.effect !== opposite)
    const boosted = isSpellSpecialist(hero, spell)
    updateUnit(draft, target.id, { effects: [...effects, { effect: spell, roundsLeft: Math.max(1, hero.spellPower), boosted }] })
  }

  const after = getUnit(draft, target.id)!
  draft.events.push({
    kind: 'spell',
    spell,
    caster,
    targetId: target.id,
    damage: 0,
    kills: 0,
    targetCount: after.count,
    targetTopHp: after.topHp,
  })
}
