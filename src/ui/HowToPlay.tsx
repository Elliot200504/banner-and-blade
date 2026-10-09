import { ARMY_BUDGET } from '../game'

/** The rules in short, shown from the start screen and from the settings. */
export function HowToPlay() {
  return (
    <ul className="rules__list">
      <li>Stacks act in order of speed. Watch the turn order bar to see who goes next.</li>
      <li>Click a shaded hex to move. Click an enemy to attack; aim at the side you want to strike from.</li>
      <li>Shooters have limited range and shots. With an enemy next to them they must fight in melee at half damage.</li>
      <li>Enemies hit in melee strike back once per round (Griffins and Minotaurs twice; nobody strikes back at Vampires or Devils).</li>
      <li>Medusas can turn a stack to stone: it loses its next turn and cannot strike back until then.</li>
      <li>Dragons shrug off spells of level 1 to 3. Angels and Devils hate each other and hit each other harder.</li>
      <li>C: your hero casts one spell per round without ending the turn.</li>
      <li>W: wait and act later this round. D: defend for extra defense.</li>
      <li>Each side has {ARMY_BUDGET.toLocaleString('en-US')} gold to recruit its army: up to one stack of each creature.</li>
      <li>
        War machines never move. A Ballista shoots every turn, a First Aid Tent heals your most wounded stack each round,
        and an Ammo Cart keeps your shooters supplied. They can't win a battle on their own.
      </li>
      <li>
        The gold arrows next to each creature upgrade it, as in HoMM3: Crusaders, Vampire Lords, Black Dragons and the rest are
        stronger, and cost more.
      </li>
      <li>Each hero has a specialty: a creature they lead better, or a spell they cast harder.</li>
      <li>Good morale may grant an extra turn; luck may double damage.</li>
      <li>Right-click any stack to see its full stats. Destroy every enemy stack to win.</li>
    </ul>
  )
}
