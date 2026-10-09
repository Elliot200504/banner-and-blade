const REPOSITORY_URL = 'https://github.com/Elliot200504/banner-and-blade'
const STEAM_URL = 'https://store.steampowered.com/app/297000/Heroes_of_Might__Magic_III__HD_Edition/'
const GOG_URL = 'https://www.gog.com/en/game/heroes_of_might_and_magic_3_complete_edition'

/** Why this game exists, shown from the start screen and the battle header. */
export function About() {
  return (
    <div className="about">
      <p className="about__lead">A love letter to the battles of Heroes of Might and Magic III.</p>
      <div className="info-grid">
        <section className="info-card">
          <h3 className="settings__heading info-card__heading">
            Why I made this
          </h3>
          <p className="info-card__text">
            Heroes of Might and Magic III is one of my all-time favourite games. The battles are the best part: turn-based,
            tactical, and with a lot of depth.
          </p>
          <p className="info-card__text">
            Banner &amp; Blade is a fun project where I try to rebuild those battle mechanics from scratch, just to see how
            close I can get.
          </p>
        </section>
        <section className="info-card">
          <h3 className="settings__heading info-card__heading">
            Strategy
          </h3>
          <p className="info-card__text">Fun, interesting strategies can be used to win.</p>
          <p className="info-card__text">I'm not saying my creation is "balanced", but I think it's fun.</p>
        </section>
        <section className="info-card">
          <h3 className="settings__heading info-card__heading">
            Play the original
          </h3>
          <p className="info-card__text">
            It's a copy of their battle mechanics. Go play the real thing on{' '}
            <a className="about__link" href={STEAM_URL} target="_blank" rel="noreferrer">
              Steam
            </a>{' '}
            or{' '}
            <a className="about__link" href={GOG_URL} target="_blank" rel="noreferrer">
              GOG
            </a>
            .
          </p>
          <p className="info-card__text info-card__text--aside">
            Ubisoft holds the keys to the series these days. Or, as the fans call them now, Ubislop.
          </p>
        </section>
        <section className="info-card">
          <h3 className="settings__heading info-card__heading">
            The code
          </h3>
          <p className="info-card__text">
            The code is open on{' '}
            <a className="about__link" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
            . All art, sound effects and music are AI-generated.
          </p>
        </section>
      </div>
    </div>
  )
}

/** A framed button with the GitHub mark, linking to this game's code. */
export function GitHubLink() {
  return (
    <a className="button button--secondary github-link" href={REPOSITORY_URL} target="_blank" rel="noreferrer" aria-label="Banner & Blade on GitHub">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
        />
      </svg>
      GitHub
    </a>
  )
}
