/**
 * The music, written as data: a chord progression, and tracks that play over it.
 * The engine in music.ts turns this into sound; nothing here touches Web Audio, so it can be tested.
 */

/** How one synthesised instrument sounds. */
export interface Voice {
  wave: OscillatorType
  /** Detune, in cents, of extra copies of the oscillator, for a fuller, chorused sound. */
  detune?: number[]
  attack: number
  /** How fast the note falls from its peak towards the sustain level (a time constant, in seconds). */
  decay: number
  /** Level held while the note lasts, from 0 to 1 of the peak. */
  sustain: number
  release: number
  /** Low-pass filter cutoff, in Hz. */
  cutoff: number
  /** The cutoff starts this many times higher and falls back with the decay: a plucked "pew". */
  filterEnvelope?: number
  resonance?: number
  /** Vibrato depth, in cents. */
  vibrato?: number
  gain: number
  /** How much goes to the echo and to the reverb, from 0 to 1. */
  delay?: number
  reverb?: number
}

export type DrumId = 'kick' | 'snare' | 'hat' | 'tom' | 'timpani' | 'frame' | 'shaker'

interface TrackBase {
  /** Which passes through the progression the track plays in; all of them when left out. */
  passes?: number[]
  gain?: number
}

/**
 * - `chord`: `x` plays the whole chord, `-` holds it, `.` is silent.
 * - `arpeggio`: a digit plays that chord tone (0 is the root, counting up through the octaves), `-` holds, `.` is silent.
 * - `melody`: one string per bar of notes and lengths in steps, like `E5:4 D5:2 r:2`, where `r` is a rest.
 * - `drums`: a letter hits the drum (capital letters harder), `.` is silent.
 */
export type Track =
  | (TrackBase & { type: 'chord'; voice: Voice; octave: number; pattern: string })
  | (TrackBase & { type: 'arpeggio'; voice: Voice; octave: number; pattern: string })
  | (TrackBase & { type: 'melody'; voice: Voice; bars: string[] })
  | (TrackBase & { type: 'drums'; drum: DrumId; pattern: string; reverb?: number })

export interface Song {
  /** Quarter notes per minute; a step is a sixteenth note. */
  tempo: number
  stepsPerBar: number
  /** One chord per bar. */
  chords: string[]
  /** How many times the progression is played before the song starts over. */
  passes: number
  tracks: Track[]
}

// ---------- Notation ----------

const PITCH_CLASSES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

const CHORD_INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '5': [0, 7],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
}

function pitchClass(name: string): number {
  const base = PITCH_CLASSES[name[0]]

  if (base === undefined) {
    throw new Error(`Unknown note: ${name}`)
  }

  if (name[1] === '#') {
    return base + 1
  }

  if (name[1] === 'b') {
    return base - 1
  }

  return base
}

/** A note name like `F#4` as a MIDI note number (A4 is 69). */
export function noteNumber(name: string): number {
  const match = /^([A-G][#b]?)(-?\d)$/.exec(name)

  if (!match) {
    throw new Error(`Unknown note: ${name}`)
  }

  return 12 * (Number(match[2]) + 1) + pitchClass(match[1])
}

export function frequencyOf(note: number): number {
  return 440 * 2 ** ((note - 69) / 12)
}

/** The notes of a chord like `F#m` or `Gsus4`, as tone number → MIDI note, starting from the root in `octave`. */
export function chordTone(chord: string, octave: number, tone: number): number {
  const match = /^([A-G][#b]?)(.*)$/.exec(chord)
  const intervals = match ? CHORD_INTERVALS[match[2]] : undefined

  if (!match || !intervals) {
    throw new Error(`Unknown chord: ${chord}`)
  }

  const root = 12 * (octave + 1) + pitchClass(match[1])

  return root + intervals[tone % intervals.length] + 12 * Math.floor(tone / intervals.length)
}

export function chordSize(chord: string): number {
  return CHORD_INTERVALS[chord.replace(/^[A-G][#b]?/, '')]?.length ?? 0
}

export interface MelodyNote {
  step: number
  steps: number
  /** MIDI note number. */
  note: number
}

/** One melody bar, like `E5:4 D5:2 r:2`, as the notes it starts. */
export function parseBar(bar: string): { notes: MelodyNote[]; steps: number } {
  const notes: MelodyNote[] = []
  let step = 0

  for (const token of bar.trim().split(/\s+/)) {
    const [name, length] = token.split(':')
    const steps = Number(length)

    if (!Number.isInteger(steps) || steps <= 0) {
      throw new Error(`Bad note length: ${token}`)
    }

    if (name !== 'r') {
      notes.push({ step, steps, note: noteNumber(name) })
    }

    step += steps
  }

  return { notes, steps: step }
}

/** How many steps a pattern note lasts: itself and every `-` after it. */
export function heldSteps(pattern: string, step: number): number {
  let steps = 1

  while (pattern[step + steps] === '-') {
    steps++
  }

  return steps
}

// ---------- Instruments ----------

const HARP: Voice = { wave: 'triangle', attack: 0.004, decay: 0.35, sustain: 0, release: 0.4, cutoff: 3200, gain: 0.16, reverb: 0.45 }
const STRINGS: Voice = {
  wave: 'sawtooth',
  detune: [-8, 8],
  attack: 0.6,
  decay: 1,
  sustain: 0.8,
  release: 1.2,
  cutoff: 1100,
  vibrato: 6,
  gain: 0.05,
  reverb: 0.6,
}
const SOFT_BASS: Voice = { wave: 'triangle', attack: 0.01, decay: 0.6, sustain: 0.4, release: 0.25, cutoff: 600, gain: 0.3, reverb: 0.1 }
const FLUTE: Voice = { wave: 'sine', attack: 0.06, decay: 0.4, sustain: 0.75, release: 0.25, cutoff: 4000, vibrato: 12, gain: 0.13, reverb: 0.5, delay: 0.15 }
const CELLO_STACCATO: Voice = {
  wave: 'sawtooth',
  detune: [-6, 6],
  attack: 0.008,
  decay: 0.09,
  sustain: 0.2,
  release: 0.08,
  cutoff: 900,
  filterEnvelope: 2,
  gain: 0.1,
  reverb: 0.25,
}
const BRASS: Voice = {
  wave: 'sawtooth',
  detune: [-5, 5],
  attack: 0.05,
  decay: 0.3,
  sustain: 0.7,
  release: 0.2,
  cutoff: 1500,
  filterEnvelope: 1.8,
  vibrato: 8,
  gain: 0.07,
  reverb: 0.4,
}
const LUTE: Voice = { wave: 'sawtooth', attack: 0.003, decay: 0.22, sustain: 0, release: 0.3, cutoff: 1400, filterEnvelope: 3, gain: 0.12, reverb: 0.35 }
const RECORDER: Voice = { wave: 'triangle', attack: 0.04, decay: 0.3, sustain: 0.8, release: 0.15, cutoff: 3000, vibrato: 10, gain: 0.18, reverb: 0.4 }
const DRONE: Voice = {
  wave: 'sawtooth',
  detune: [-4, 4],
  attack: 1,
  decay: 1,
  sustain: 0.9,
  release: 1.5,
  cutoff: 500,
  gain: 0.06,
  reverb: 0.5,
}
const WAR_HORN: Voice = {
  wave: 'square',
  detune: [-6, 6],
  attack: 0.07,
  decay: 0.4,
  sustain: 0.75,
  release: 0.3,
  cutoff: 1200,
  vibrato: 5,
  gain: 0.06,
  reverb: 0.45,
}
const SYNTH_BASS: Voice = { wave: 'sawtooth', attack: 0.005, decay: 0.15, sustain: 0.35, release: 0.08, cutoff: 500, filterEnvelope: 3, resonance: 6, gain: 0.13 }
const SYNTH_PAD: Voice = {
  wave: 'sawtooth',
  detune: [-12, 0, 12],
  attack: 1.2,
  decay: 1.5,
  sustain: 0.85,
  release: 2,
  cutoff: 1400,
  gain: 0.035,
  reverb: 0.7,
}
const SYNTH_ARP: Voice = { wave: 'square', attack: 0.003, decay: 0.12, sustain: 0, release: 0.1, cutoff: 2400, filterEnvelope: 2, gain: 0.05, delay: 0.45, reverb: 0.3 }
const SYNTH_LEAD: Voice = {
  wave: 'sawtooth',
  detune: [-7, 7],
  attack: 0.02,
  decay: 0.3,
  sustain: 0.7,
  release: 0.3,
  cutoff: 2200,
  filterEnvelope: 1.5,
  vibrato: 9,
  gain: 0.06,
  delay: 0.35,
  reverb: 0.4,
}

// ---------- Default: an orchestral fantasy, like the towns of Heroes III ----------

const DEFAULT_MENU: Song = {
  tempo: 84,
  stepsPerBar: 16,
  chords: ['D', 'Bm', 'G', 'A', 'D', 'F#m', 'G', 'A'],
  passes: 3,
  tracks: [
    { type: 'arpeggio', voice: HARP, octave: 4, pattern: '0.1.2.3.4.3.2.1.' },
    { type: 'chord', voice: STRINGS, octave: 3, pattern: 'x---------------' },
    { type: 'arpeggio', voice: SOFT_BASS, octave: 2, pattern: '0-------2-------' },
    { type: 'drums', drum: 'frame', pattern: 'f.......f.....f.', gain: 0.6 },
    { type: 'drums', drum: 'shaker', pattern: '..s...s...s...s.', gain: 0.5 },
    {
      type: 'melody',
      voice: FLUTE,
      passes: [1, 2],
      bars: [
        'F#5:6 E5:2 D5:4 A4:4',
        'B4:6 C#5:2 D5:4 F#5:4',
        'G5:6 F#5:2 E5:4 D5:4',
        'E5:12 r:4',
        'F#5:6 E5:2 D5:4 F#5:4',
        'A5:6 G5:2 F#5:4 C#5:4',
        'B4:4 D5:4 G5:4 F#5:2 E5:2',
        'E5:8 C#5:4 A4:4',
        'A5:6 F#5:2 A5:4 D6:4',
        'B5:6 A5:2 F#5:8',
        'G5:4 B5:4 A5:4 G5:2 F#5:2',
        'E5:6 F#5:2 G5:4 A5:4',
        'F#5:6 E5:2 D5:4 A4:4',
        'C#5:6 D5:2 E5:4 F#5:4',
        'G5:4 F#5:4 E5:4 D5:4',
        'C#5:4 E5:4 A5:8',
      ],
    },
  ],
}

const DEFAULT_BATTLE: Song = {
  tempo: 112,
  stepsPerBar: 16,
  chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'],
  passes: 3,
  tracks: [
    { type: 'arpeggio', voice: CELLO_STACCATO, octave: 3, pattern: '0.000.000.003.22' },
    { type: 'chord', voice: STRINGS, octave: 3, pattern: 'x-------x-------' },
    { type: 'arpeggio', voice: SOFT_BASS, octave: 2, pattern: '0-------0---0---' },
    { type: 'drums', drum: 'timpani', pattern: 'T.......t.....t.' },
    { type: 'drums', drum: 'snare', pattern: '....s.......s.ss', gain: 0.45 },
    {
      type: 'melody',
      voice: BRASS,
      passes: [1, 2],
      bars: [
        'D5:6 E5:2 F5:4 A5:4',
        'G5:6 F5:2 E5:4 D5:4',
        'F5:6 D5:2 Bb4:8',
        'C5:4 E5:4 G5:8',
        'A5:6 G5:2 F5:4 D5:4',
        'E5:4 F5:4 G5:4 A5:4',
        'Bb5:6 A5:2 G5:4 D5:4',
        'C#5:8 E5:4 A4:4',
        'D6:6 C6:2 A5:4 F5:4',
        'G5:4 A5:4 F5:4 D5:4',
        'F5:4 Bb5:4 A5:4 F5:4',
        'G5:6 F5:2 E5:4 C5:4',
        'D5:2 F5:2 A5:4 D6:8',
        'C6:4 A5:4 F5:4 A5:4',
        'G5:4 Bb5:4 D6:4 Bb5:4',
        'A5:8 C#6:4 E6:4',
      ],
    },
  ],
}

// ---------- Medieval: a lute and recorder by the hearth, war drums on the field ----------

const MEDIEVAL_MENU: Song = {
  tempo: 96,
  stepsPerBar: 12,
  chords: ['Dm', 'C', 'Dm', 'G', 'Dm', 'C', 'Am', 'Dm'],
  passes: 3,
  tracks: [
    { type: 'arpeggio', voice: LUTE, octave: 3, pattern: '0.2.3.1.2.3.' },
    { type: 'chord', voice: DRONE, octave: 2, pattern: 'x-----------' },
    { type: 'drums', drum: 'frame', pattern: 'F.....f..f..', gain: 0.8 },
    { type: 'drums', drum: 'shaker', pattern: '..s..s..s..s', gain: 0.35, passes: [1, 2] },
    {
      type: 'melody',
      voice: RECORDER,
      passes: [1, 2],
      bars: [
        'A4:4 D5:2 E5:2 F5:4',
        'E5:4 C5:2 D5:2 E5:4',
        'F5:4 E5:2 D5:2 A4:4',
        'B4:6 G4:6',
        'D5:4 F5:2 A5:2 G5:4',
        'E5:4 G5:2 E5:2 C5:4',
        'A4:4 C5:2 E5:2 D5:2 C5:2',
        'D5:12',
        'A5:4 G5:2 F5:2 A5:4',
        'G5:4 E5:2 C5:2 G5:4',
        'F5:2 E5:2 F5:2 A5:2 D5:4',
        'B4:4 D5:2 G5:2 D5:4',
        'F5:4 E5:2 D5:2 E5:2 F5:2',
        'G5:4 F5:2 E5:2 C5:4',
        'E5:4 D5:2 C5:2 B4:2 C5:2',
        'D5:6 r:6',
      ],
    },
  ],
}

const MEDIEVAL_BATTLE: Song = {
  tempo: 104,
  stepsPerBar: 16,
  chords: ['Em', 'F', 'Em', 'Dm', 'C', 'Dm', 'F', 'Em'],
  passes: 3,
  tracks: [
    { type: 'arpeggio', voice: CELLO_STACCATO, octave: 2, pattern: '0.0.0.0.0.0.2.1.' },
    { type: 'chord', voice: DRONE, octave: 3, pattern: 'x---------------' },
    { type: 'drums', drum: 'tom', pattern: 'T..t..t.T..t.tt.' },
    { type: 'drums', drum: 'kick', pattern: 'k.......k.......', gain: 0.7 },
    { type: 'drums', drum: 'snare', pattern: '....s.......s..s', gain: 0.35, passes: [1, 2] },
    {
      type: 'melody',
      voice: WAR_HORN,
      passes: [1, 2],
      bars: [
        'E5:6 F5:2 G5:4 E5:4',
        'F5:6 E5:2 D5:4 C5:4',
        'B4:6 C5:2 E5:4 G5:4',
        'A4:8 D5:8',
        'G5:6 E5:2 C5:4 E5:4',
        'A5:6 F5:2 D5:8',
        'C6:4 A5:4 F5:4 A5:4',
        'G5:4 F5:4 E5:8',
        'B5:6 A5:2 G5:4 B5:4',
        'C6:6 B5:2 A5:4 F5:4',
        'G5:4 E5:4 B4:4 E5:4',
        'F5:4 E5:4 D5:4 A4:4',
        'C5:4 E5:4 G5:4 C6:4',
        'D6:6 C6:2 A5:8',
        'A5:4 G5:4 F5:4 G5:4',
        'E5:12 r:4',
      ],
    },
  ],
}

// ---------- Synthwave: a night drive for the menu, a chase on the grid for battle ----------

const SYNTHWAVE_MENU: Song = {
  tempo: 92,
  stepsPerBar: 16,
  chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'],
  passes: 3,
  tracks: [
    { type: 'arpeggio', voice: SYNTH_BASS, octave: 2, pattern: '0.0.0.0.0.0.0.0.' },
    { type: 'chord', voice: SYNTH_PAD, octave: 3, pattern: 'x---------------' },
    { type: 'arpeggio', voice: SYNTH_ARP, octave: 4, pattern: '0.2.1.3.0.2.1.3.', passes: [1, 2] },
    { type: 'drums', drum: 'kick', pattern: 'k.......k.......' },
    { type: 'drums', drum: 'snare', pattern: '....s.......s...', reverb: 0.6, gain: 0.7 },
    { type: 'drums', drum: 'hat', pattern: '..h...h...h...h.', gain: 0.6 },
    {
      type: 'melody',
      voice: SYNTH_LEAD,
      passes: [1, 2],
      bars: [
        'E5:6 D5:2 C5:4 A4:4',
        'C5:6 D5:2 E5:4 F5:4',
        'G5:6 E5:2 C5:8',
        'D5:6 E5:2 B4:8',
        'A4:4 C5:4 E5:4 A5:4',
        'G5:6 F5:2 E5:4 C5:4',
        'E5:6 G5:2 C6:4 B5:4',
        'B5:6 A5:2 G5:8',
        'A5:12 G5:2 E5:2',
        'F5:8 A5:4 C6:4',
        'G5:8 E5:4 G5:4',
        'D5:8 B4:4 D5:4',
        'E5:6 C5:2 A4:4 E5:4',
        'F5:6 E5:2 F5:4 A5:4',
        'G5:4 E5:4 C5:4 E5:4',
        'D5:12 r:4',
      ],
    },
  ],
}

const SYNTHWAVE_BATTLE: Song = {
  tempo: 128,
  stepsPerBar: 16,
  chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B'],
  passes: 3,
  tracks: [
    { type: 'arpeggio', voice: SYNTH_BASS, octave: 2, pattern: '0003000300030020' },
    { type: 'chord', voice: SYNTH_PAD, octave: 3, pattern: 'x-------x-------' },
    { type: 'arpeggio', voice: SYNTH_ARP, octave: 4, pattern: '0123012301230123' },
    { type: 'drums', drum: 'kick', pattern: 'K...k...K...k...' },
    { type: 'drums', drum: 'snare', pattern: '....S.......S...', reverb: 0.5, gain: 0.8 },
    { type: 'drums', drum: 'hat', pattern: '..h...h...h...hh', gain: 0.7 },
    {
      type: 'melody',
      voice: SYNTH_LEAD,
      passes: [1, 2],
      bars: [
        'B4:4 E5:4 G5:4 B5:4',
        'A5:4 G5:4 F#5:4 E5:4',
        'G5:6 E5:2 C5:8',
        'F#5:6 A5:2 D6:8',
        'E6:6 D6:2 B5:4 G5:4',
        'A5:4 B5:4 G5:4 E5:4',
        'C6:4 B5:4 G5:4 E5:4',
        'D#5:8 F#5:4 B5:4',
        'E5:2 G5:2 B5:4 E5:2 G5:2 B5:4',
        'D6:4 B5:4 A5:4 G5:4',
        'E5:2 G5:2 C6:4 E5:2 G5:2 C6:4',
        'D6:4 C6:4 A5:4 F#5:4',
        'G5:4 F#5:4 E5:4 B4:4',
        'E5:4 F#5:4 G5:4 A5:4',
        'B5:4 G5:4 E5:4 C6:4',
        'B5:8 D#6:4 F#6:4',
      ],
    },
  ],
}

export type SongId = `${'default' | 'medieval' | 'synthwave'}:${'menu' | 'battle'}`

export const SONGS: Record<SongId, Song> = {
  'default:menu': DEFAULT_MENU,
  'default:battle': DEFAULT_BATTLE,
  'medieval:menu': MEDIEVAL_MENU,
  'medieval:battle': MEDIEVAL_BATTLE,
  'synthwave:menu': SYNTHWAVE_MENU,
  'synthwave:battle': SYNTHWAVE_BATTLE,
}
