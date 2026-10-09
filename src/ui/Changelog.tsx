interface ChangelogEntry {
  /** ISO date, so entries sort and display the same everywhere. */
  date: string
  changes: string[]
}

/** What has been added over time, newest first. Add a line here with each new feature. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-10-09',
    changes: [
      'A new start screen: a big title, a bigger To battle! button, and each side set up step by step with nothing picked for you.',
      'Sound settings with a speaker toggle and volume slider for music and sound effects.',
      'An About page, and How to play rewritten as a few simple cards with a live demo battle.',
      'Expert computer opponent: strikes first, kites out of reach, shields its shooters and baits out retaliation.',
      'Creature upgrades from HoMM3: Halberdiers, Crusaders, Vampire Lords, Black Dragons and the rest.',
      'War machines: Ballista, First Aid Tent and Ammo Cart.',
      'Rampart, Stronghold and Inferno join the battle, with full HoMM3 lineups and army building with a gold budget.',
      'Music, sound effects and three themes: Default, Medieval and Synthwave.',
      'Computer opponent with Easy, Normal and Hard difficulty, which waits for you and retreats from hopeless fights.',
      'HoMM3 heroes with portraits and specialties.',
      'Dungeon joins the battle, and each half of the field looks like its army’s homeland.',
      'The game is now playable online.',
    ],
  },
  {
    date: '2026-10-08',
    changes: [
      'The first playable version: hot-seat hex battles with Castle and Necropolis.',
      'Creature stacks, heroes, spells, ranged attacks and retaliation.',
      'Pixel-art creatures and obstacles.',
    ],
  },
]

const formatDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

/** The changelog as one card per day, shown from the start screen. */
export function Changelog() {
  return (
    <div className="changelog">
      {CHANGELOG.map((entry) => (
        <section key={entry.date} className="info-card">
          <h3 className="settings__heading info-card__heading">{formatDate(entry.date)}</h3>
          <ul className="changelog__list">
            {entry.changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
