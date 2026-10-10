/** Moving and fighting: walking or flying, shots, melee blows, retaliation and every ability that changes them. */

import { afterDamage, CURSE_CHANCE, CURSE_ROUNDS, PETRIFY_CHANCE, rollDamage, totalHp } from '../combat'
import { CREATURES, hasAbility, isWarMachine } from '../creatures'
import { hexKey, sameHex, type Hex } from '../hex'
import { attackMode, pathLength, reachableHexes, strikesFrom, unitDistance } from '../movement'
import type { GameState, Unit } from '../types'
import { describe, getUnit, recordLosses, updateUnit, type Draft } from './draft'
import { breathVictim, isImmune, usesAmmunition } from './unitRules'

export function walk(draft: Draft, obstacles: GameState['obstacles'], unitId: string, destination: Hex): number | null {
  const unit = getUnit(draft, unitId)!
  const path = reachableHexes({ units: draft.units, obstacles }, unit).get(hexKey(destination))

  if (!path) {
    return null
  }

  updateUnit(draft, unitId, { position: destination })
  const flying = hasAbility(unit.type, 'flying')
  draft.events.push({ kind: 'move', unitId, path, flying })
  draft.log.push(`${unit.label} ${flying ? 'fly' : 'move'}.`)

  return pathLength(path)
}

function strike(
  draft: Draft,
  attackerId: string,
  targetId: string,
  options: { ranged: boolean; retaliation: boolean; splash: boolean; hexesMoved: number },
) {
  const attacker = getUnit(draft, attackerId)!
  const target = getUnit(draft, targetId)!
  const roll = rollDamage(
    attacker,
    draft.heroes[attacker.owner],
    target,
    draft.heroes[target.owner],
    { ranged: options.ranged, hexesMoved: options.hexesMoved, canBeLucky: !options.splash },
    draft.random,
  )
  const result = afterDamage(target, roll.damage)
  updateUnit(draft, targetId, { count: result.count, topHp: result.topHp })
  recordLosses(draft, target, result.kills)
  draft.events.push({
    kind: 'attack',
    attackerId,
    targetId,
    damage: roll.damage,
    kills: result.kills,
    ranged: options.ranged,
    retaliation: options.retaliation,
    splash: options.splash,
    lucky: roll.lucky,
    deathblow: roll.deathblow,
    targetCount: result.count,
    targetTopHp: result.topHp,
  })

  if (roll.lucky) {
    draft.log.push(`Lucky strike! ${attacker.label} deal double damage.`)
  }

  if (roll.deathblow) {
    draft.log.push(`Deathblow! ${attacker.label} deal double damage.`)
  }

  if (hasAbility(attacker.type, 'lifeDrain') && !options.ranged && !options.splash) {
    drainLife(draft, attackerId, target, Math.min(roll.damage, totalHp(target)))
  }

  const splashVerb = hasAbility(attacker.type, 'breath') ? 'Dragon fire burns' : 'The death cloud hits'
  const verb = options.splash ? splashVerb : options.retaliation ? 'strike back at' : options.ranged ? 'shoot' : 'attack'
  const subject = options.splash ? '' : `${describe(attacker)} `
  draft.log.push(`${subject}${verb} ${target.label} for ${roll.damage}. ${result.kills} perish.`)

  if (result.count === 0) {
    draft.events.push({ kind: 'death', unitId: targetId })
    draft.log.push(`${target.label} are destroyed!`)
  } else if (
    hasAbility(attacker.type, 'petrify') &&
    !options.splash &&
    !target.petrified &&
    draft.random.chance(PETRIFY_CHANCE)
  ) {
    updateUnit(draft, targetId, { petrified: true })
    draft.events.push({ kind: 'petrify', unitId: targetId })
    draft.log.push(`${target.label} are turned to stone!`)
  } else if (
    hasAbility(attacker.type, 'cursing') &&
    !options.ranged &&
    !options.splash &&
    !isImmune(target, 'curse') &&
    draft.random.chance(CURSE_CHANCE)
  ) {
    const effects = target.effects.filter((active) => active.effect !== 'curse' && active.effect !== 'bless')
    updateUnit(draft, targetId, { effects: [...effects, { effect: 'curse', roundsLeft: CURSE_ROUNDS }] })
    draft.log.push(`${target.label} are cursed!`)
  }
}

/**
 * A Vampire Lord's blow heals it by the damage dealt, raising its fallen up to the size it started with.
 * The undead and war machines have no life to drain.
 */
function drainLife(draft: Draft, drinkerId: string, victim: Unit, damage: number) {
  const drinker = getUnit(draft, drinkerId)!

  if (damage <= 0 || drinker.count === 0 || hasAbility(victim.type, 'undead') || isWarMachine(victim.type)) {
    return
  }

  const stats = CREATURES[drinker.type]
  const health = Math.min(drinker.startCount * stats.hp, totalHp(drinker) + damage)
  const count = Math.ceil(health / stats.hp)
  const topHp = health - (count - 1) * stats.hp
  const healed = health - totalHp(drinker)

  if (healed <= 0) {
    return
  }

  updateUnit(draft, drinkerId, { count, topHp })
  const losses = draft.casualties[drinker.owner]
  losses[drinker.type] = Math.max(0, (losses[drinker.type] ?? 0) - (count - drinker.count))
  draft.events.push({ kind: 'heal', unitId: drinkerId, healerId: drinkerId, amount: healed, topHp })
  draft.log.push(`${drinker.label} drain ${healed} health.`)
}

/** A melee blow, plus the dragon's breath on whoever stands behind the target. */
function meleeStrike(draft: Draft, attackerId: string, targetId: string, options: { retaliation: boolean; hexesMoved: number }) {
  const attacker = getUnit(draft, attackerId)!
  const target = getUnit(draft, targetId)!
  const burned = hasAbility(attacker.type, 'breath') ? breathVictim(draft.units, attacker.position, target) : undefined
  strike(draft, attackerId, targetId, { ranged: false, splash: false, ...options })

  if (burned) {
    strike(draft, attackerId, burned.id, { ranged: false, retaliation: options.retaliation, splash: true, hexesMoved: 0 })
  }
}

export function performAttack(draft: Draft, state: GameState, actor: Unit, targetId: string, from?: Hex): boolean {
  const target = getUnit(draft, targetId)

  if (!target) {
    return false
  }

  const mode = attackMode(state, actor, target)

  if (!mode) {
    return false
  }

  if (mode === 'shoot') {
    if (usesAmmunition(draft.units, actor)) {
      updateUnit(draft, actor.id, { shots: actor.shots - 1 })
    }

    // Marksmen and Grand Elves loose a second arrow if the target still stands.
    const volleys = hasAbility(actor.type, 'doubleShot') ? 2 : 1

    for (let volley = 0; volley < volleys && getUnit(draft, targetId)!.count > 0; volley++) {
      strike(draft, actor.id, targetId, { ranged: true, retaliation: false, splash: false, hexesMoved: 0 })

      if (hasAbility(actor.type, 'deathCloud')) {
        const caught = draft.units.filter(
          (unit) => unit.id !== targetId && unit.count > 0 && unitDistance(unit, target) === 1 && !hasAbility(unit.type, 'undead'),
        )

        for (const unit of caught) {
          strike(draft, actor.id, unit.id, { ranged: true, retaliation: false, splash: true, hexesMoved: 0 })
        }
      }
    }

    return true
  }

  const origin = from ?? actor.position

  if (!strikesFrom(actor, origin, target)) {
    return false
  }

  let hexesMoved = 0

  if (!sameHex(origin, actor.position)) {
    const walked = walk(draft, state.obstacles, actor.id, origin)

    if (walked === null) {
      return false
    }

    hexesMoved = walked
  }

  meleeStrike(draft, actor.id, targetId, { retaliation: false, hexesMoved })

  const victim = getUnit(draft, targetId)!
  const canRetaliate = victim.count > 0 && victim.retaliationsLeft > 0 && !victim.petrified && !isWarMachine(victim.type)

  if (canRetaliate && !hasAbility(actor.type, 'noRetaliation')) {
    if (!hasAbility(victim.type, 'unlimitedRetaliation')) {
      updateUnit(draft, targetId, { retaliationsLeft: victim.retaliationsLeft - 1 })
    }

    meleeStrike(draft, targetId, actor.id, { retaliation: true, hexesMoved: 0 })
  }

  // Crusaders and Wolf Raiders strike again once the target has struck back.
  if (hasAbility(actor.type, 'doubleStrike') && getUnit(draft, actor.id)!.count > 0 && getUnit(draft, targetId)!.count > 0) {
    meleeStrike(draft, actor.id, targetId, { retaliation: false, hexesMoved: 0 })
  }

  const survivor = getUnit(draft, actor.id)!

  if (hasAbility(actor.type, 'hitAndRun') && survivor.count > 0 && !sameHex(survivor.position, actor.position)) {
    updateUnit(draft, actor.id, { position: actor.position })
    draft.events.push({ kind: 'move', unitId: actor.id, path: [survivor.position, actor.position], flying: true })
    draft.log.push(`${actor.label} fly back.`)
  }

  return true
}
