/**
 * The battle rules, split by what they govern:
 * - gameRules: applying a move and deciding the winner
 * - turnRules: turn order, and what happens as turns and rounds begin
 * - attackRules: moving, shooting, melee and retaliation
 * - spellRules: casting hero spells
 * - unitRules: what a single stack can and cannot do
 */
export { applyMove } from './gameRules'
export { activeUnit, buildQueue, FIRST_AID_MAXIMUM, FIRST_AID_MINIMUM } from './turnRules'
export { castProblem, spellVictims } from './spellRules'
export { breathVictim, isImmune, MAGIC_RESISTANCE_CHANCE, moraleOf, SPELL_IMMUNITY_LEVEL, usesAmmunition } from './unitRules'
