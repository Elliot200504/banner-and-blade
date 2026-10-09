/**
 * Balance report: the computer plays every pairing of heroes against itself and the
 * win rates are printed. Each pairing is played equally often from both sides.
 *
 *   npm run balance                                  100 games per pairing, Normal vs Normal
 *   npm run balance -- --games 40                    a quicker, rougher run
 *   npm run balance -- --difficulty hard --against normal
 *                                                    the row hero plays Hard, the column hero Normal
 *   npm run balance -- --mirrors                     also play each hero against itself
 *   npm run balance -- --workers 4 --seed 7
 *
 * Games are spread over several processes, each running this same file with
 * BALANCE_WORKER set and its jobs on stdin.
 */
import { spawn } from 'node:child_process'
import { cpus } from 'node:os'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import {
  activeUnit,
  applyMove,
  chooseMove,
  createBattle,
  DIFFICULTIES,
  FACTIONS,
  HERO_ORDER,
  HEROES,
  opponentOf,
  type Difficulty,
  type Faction,
  type HeroId,
  type Player,
} from '../src/game'

/** A battle still going after this many moves counts as a draw. */
const MAX_MOVES = 3000

interface Job {
  /** The row hero in the report, and the one playing `difficulty`. */
  hero: HeroId
  opponent: HeroId
  heroSide: Player
  difficulty: Difficulty
  against: Difficulty
  seed: number
}

interface Result {
  job: Job
  /** Whose side won, or null for a draw. */
  winner: 'hero' | 'opponent' | null
  rounds: number
}

function play(job: Job): Result {
  const opponentSide = opponentOf(job.heroSide)
  const factions = { [job.heroSide]: HEROES[job.hero].faction, [opponentSide]: HEROES[job.opponent].faction } as Record<
    Player,
    Faction
  >
  const heroes = { [job.heroSide]: job.hero, [opponentSide]: job.opponent } as Record<Player, HeroId>
  const difficulties = { [job.heroSide]: job.difficulty, [opponentSide]: job.against } as Record<Player, Difficulty>
  let state = createBattle(factions, job.seed, heroes)
  for (let moves = 0; !state.winner && moves < MAX_MOVES; moves++) {
    const player = activeUnit(state)!.owner
    state = applyMove(state, chooseMove(state, difficulties[player]))
  }
  const winner = state.winner === null ? null : state.winner === job.heroSide ? 'hero' : 'opponent'
  return { job, winner, rounds: state.round }
}

/** Plays each job as it arrives on stdin, one JSON line each, and answers with one line per result. */
async function runWorker() {
  for await (const line of createInterface({ input: process.stdin })) {
    if (line.trim()) process.stdout.write(JSON.stringify(play(JSON.parse(line) as Job)) + '\n')
  }
}

// ---------- Options ----------

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function difficultyOption(name: string): Difficulty {
  const value = option(name) ?? 'normal'
  if (!DIFFICULTIES.includes(value as Difficulty)) throw new Error(`--${name} must be one of ${DIFFICULTIES.join(', ')}`)
  return value as Difficulty
}

function numberOption(name: string, fallback: number): number {
  const value = Number(option(name) ?? fallback)
  if (!Number.isInteger(value) || value < 1) throw new Error(`--${name} must be a whole number above 0`)
  return value
}

// ---------- Running the games ----------

function createJobs(games: number, difficulty: Difficulty, against: Difficulty, mirrors: boolean, baseSeed: number): Job[] {
  const jobs: Job[] = []
  // With equal difficulties, A vs B tells us B vs A too, so each pair is played once.
  // With different ones, every ordered pair is needed.
  const ordered = difficulty !== against
  HERO_ORDER.forEach((hero, row) => {
    HERO_ORDER.forEach((opponent, column) => {
      if (column < row && !ordered) return
      if (column === row && !mirrors) return
      for (let game = 0; game < games; game++) {
        const heroSide: Player = game % 2 === 0 ? 'red' : 'blue'
        jobs.push({ hero, opponent, heroSide, difficulty, against, seed: (baseSeed + jobs.length * 2654435761) >>> 0 })
      }
    })
  })
  return jobs
}

function runInWorkers(jobs: Job[], workerCount: number): Promise<Result[]> {
  const script = fileURLToPath(import.meta.url)
  const viteNode = fileURLToPath(new URL('../node_modules/vite-node/vite-node.mjs', import.meta.url))
  const results: Result[] = []
  const started = Date.now()
  let lastReport = 0

  const report = () => {
    const now = Date.now()
    if (now - lastReport < 1000 && results.length < jobs.length) return
    lastReport = now
    const elapsed = (now - started) / 1000
    const remaining = results.length ? (elapsed / results.length) * (jobs.length - results.length) : 0
    process.stderr.write(`\r${results.length}/${jobs.length} games · ${elapsed.toFixed(0)}s · about ${remaining.toFixed(0)}s left   `)
  }

  // Jobs are handed out one at a time to whichever worker is free, so no worker sits idle at the end.
  let nextJob = 0
  const workers = Array.from({ length: workerCount }, () => {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [viteNode, script], {
        env: { ...process.env, BALANCE_WORKER: '1' },
        stdio: ['pipe', 'pipe', 'inherit'],
      })
      const sendNext = () => {
        if (nextJob < jobs.length) child.stdin.write(JSON.stringify(jobs[nextJob++]) + '\n')
        else child.stdin.end()
      }
      let buffer = ''
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop()!
        for (const line of lines) {
          if (!line.trim()) continue
          results.push(JSON.parse(line) as Result)
          report()
          sendNext()
        }
      })
      child.on('error', reject)
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`A worker stopped with code ${code}`))))
      sendNext()
    })
  })

  return Promise.all(workers).then(() => {
    process.stderr.write('\n\n')
    return results
  })
}

// ---------- The report ----------

class Tally {
  wins = 0
  losses = 0
  draws = 0
  add(winner: Result['winner'], forHero: boolean) {
    if (winner === null) this.draws++
    else if ((winner === 'hero') === forHero) this.wins++
    else this.losses++
  }
  get games() {
    return this.wins + this.losses + this.draws
  }
  /** Draws count as half a win. */
  get rate() {
    return this.games ? (this.wins + this.draws / 2) / this.games : NaN
  }
  /** Half the width of a 95% confidence interval around the rate. */
  get margin() {
    return this.games ? 1.96 * Math.sqrt((this.rate * (1 - this.rate)) / this.games) : NaN
  }
}

const percent = (rate: number) => (Number.isNaN(rate) ? '–' : `${(rate * 100).toFixed(0)}%`)
const pad = (text: string, width: number) => text.padEnd(width)
const padLeft = (text: string, width: number) => text.padStart(width)

/** ▲ or ▼ when a rate is clearly above or below 50%, beyond what luck explains. */
function verdict(tally: Tally): string {
  if (tally.rate - tally.margin > 0.5) return '▲ strong'
  if (tally.rate + tally.margin < 0.5) return '▼ weak'
  return ''
}

function printReport(results: Result[], difficulty: Difficulty, against: Difficulty) {
  const sameDifficulty = difficulty === against
  const heroTallies = new Map<HeroId, Tally>(HERO_ORDER.map((hero) => [hero, new Tally()]))
  const pairTallies = new Map<string, Tally>()
  const factionTallies = new Map<string, Tally>()
  const sides = { red: 0, blue: 0, draws: 0 }
  let rounds = 0
  const difficultyTally = new Tally()
  const pairTally = (row: string, column: string) => {
    const key = `${row}|${column}`
    if (!pairTallies.has(key)) pairTallies.set(key, new Tally())
    return pairTallies.get(key)!
  }
  const factionTally = (row: Faction, column: Faction) => {
    const key = `${row}|${column}`
    if (!factionTallies.has(key)) factionTallies.set(key, new Tally())
    return factionTallies.get(key)!
  }

  for (const result of results) {
    const { hero, opponent, heroSide } = result.job
    const heroFaction = HEROES[hero].faction
    const opponentFaction = HEROES[opponent].faction
    rounds += result.rounds
    if (result.winner === null) sides.draws++
    else sides[result.winner === 'hero' ? heroSide : opponentOf(heroSide)]++
    difficultyTally.add(result.winner, true)

    pairTally(hero, opponent).add(result.winner, true)
    if (heroFaction !== opponentFaction) factionTally(heroFaction, opponentFaction).add(result.winner, true)
    if (sameDifficulty) {
      // The same game seen from the other side.
      if (hero !== opponent) {
        pairTally(opponent, hero).add(result.winner, false)
        heroTallies.get(hero)!.add(result.winner, true)
        heroTallies.get(opponent)!.add(result.winner, false)
      }
      if (heroFaction !== opponentFaction) factionTally(opponentFaction, heroFaction).add(result.winner, false)
    } else {
      heroTallies.get(hero)!.add(result.winner, true)
    }
  }

  const factions = Object.keys(FACTIONS) as Faction[]
  const label = (level: Difficulty) => level[0].toUpperCase() + level.slice(1)
  console.log(`Banner & Blade balance report: ${results.length} games, ${label(difficulty)} vs ${label(against)}`)
  console.log(`Red won ${percent(sides.red / results.length)}, Blue ${percent(sides.blue / results.length)}, ` +
    `${sides.draws} draws. Battles last ${(rounds / results.length).toFixed(1)} rounds on average.`)
  if (!sameDifficulty) {
    console.log(`${label(difficulty)} won ${percent(difficultyTally.rate)} ± ${percent(difficultyTally.margin)} against ${label(against)}.`)
  }
  console.log()

  console.log(sameDifficulty ? 'Heroes (against every other hero):' : `Heroes playing ${label(difficulty)}:`)
  const heroRows = [...heroTallies.entries()].sort((first, second) => second[1].rate - first[1].rate)
  for (const [hero, tally] of heroRows) {
    const template = HEROES[hero]
    console.log(
      `  ${pad(template.name, 10)}${pad(FACTIONS[template.faction].name, 9)}${padLeft(percent(tally.rate), 5)} ± ${pad(percent(tally.margin), 4)}` +
        `${padLeft(String(tally.games), 6)} games  ${verdict(tally)}`,
    )
  }
  console.log()

  console.log('Factions (row against column, mirror matches left out):')
  console.log(`  ${pad('', 10)}${factions.map((faction) => padLeft(FACTIONS[faction].name, 9)).join('')}`)
  for (const row of factions) {
    const cells = factions.map((column) => padLeft(row === column ? '·' : percent(factionTally(row, column).rate), 9))
    console.log(`  ${pad(FACTIONS[row].name, 10)}${cells.join('')}`)
  }
  console.log()

  console.log('Hero against hero (row win rate):')
  console.log(`  ${pad('', 10)}${HERO_ORDER.map((hero) => padLeft(HEROES[hero].name.slice(0, 6), 7)).join('')}`)
  for (const row of HERO_ORDER) {
    const cells = HERO_ORDER.map((column) => {
      const tally = pairTallies.get(`${row}|${column}`)
      return padLeft(tally ? percent(tally.rate) : '·', 7)
    })
    console.log(`  ${pad(HEROES[row].name, 10)}${cells.join('')}`)
  }
  console.log()
  console.log(`± is a 95% confidence interval. Draws (no winner after ${MAX_MOVES} moves) count as half a win.`)
}

async function main() {
  const games = numberOption('games', 100)
  const difficulty = difficultyOption('difficulty')
  const against = option('against') ? difficultyOption('against') : difficulty
  const mirrors = process.argv.includes('--mirrors')
  const seed = numberOption('seed', 1)
  const jobs = createJobs(games, difficulty, against, mirrors, seed)
  const workerCount = Math.min(jobs.length, numberOption('workers', Math.max(1, cpus().length - 1)))
  process.stderr.write(`Playing ${jobs.length} games on ${workerCount} workers…\n`)
  printReport(await runInWorkers(jobs, workerCount), difficulty, against)
}

if (process.env.BALANCE_WORKER) await runWorker()
else await main()
