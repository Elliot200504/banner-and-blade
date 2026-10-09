import { startedAudioContext } from './sound'
import {
  chordSize,
  chordTone,
  frequencyOf,
  heldSteps,
  parseBar,
  SONGS,
  type DrumId,
  type MelodyNote,
  type Song,
  type SongId,
  type Voice,
} from './songs'

/** How far ahead notes are scheduled, and how often the scheduler wakes up to do it. */
const LOOKAHEAD_SECONDS = 0.15
const TICK_MS = 25
const FADE_SECONDS = 1.5
/** Music sits under the sound effects: this is its level at 100% volume. */
const MUSIC_LEVEL = 0.6

/** The shared mixer: everything ends in `master`, with one reverb and one echo to send notes into. */
interface Bus {
  context: AudioContext
  master: GainNode
  reverb: GainNode
  echo: GainNode
  echoDelay: DelayNode
  noise: AudioBuffer
}

/** Where one song's notes go; each is faded together when the song starts or stops. */
interface Faders {
  dry: GainNode
  reverb: GainNode
  echo: GainNode
}

interface PlayingSong {
  id: SongId
  song: Song
  faders: Faders
  /** Each melody track's bars, parsed once. */
  melodies: Map<number, MelodyNote[][]>
  bar: number
  step: number
  pass: number
  nextTime: number
}

let bus: Bus | null = null
let playing: PlayingSong | null = null
let wantedSong: SongId | null = null
let volume = 0.5
let timer: ReturnType<typeof setInterval> | null = null

function createBus(context: AudioContext): Bus {
  const master = context.createGain()
  const compressor = context.createDynamicsCompressor()
  master.gain.value = volume * MUSIC_LEVEL
  master.connect(compressor).connect(context.destination)

  // A reverb from a burst of fading noise: a large stone hall.
  const impulseLength = Math.floor(context.sampleRate * 2.8)
  const impulse = context.createBuffer(2, impulseLength, context.sampleRate)

  for (let channel = 0; channel < 2; channel++) {
    const samples = impulse.getChannelData(channel)

    for (let index = 0; index < impulseLength; index++) {
      samples[index] = (Math.random() * 2 - 1) * (1 - index / impulseLength) ** 3
    }
  }

  const reverb = context.createGain()
  const convolver = context.createConvolver()
  convolver.buffer = impulse
  reverb.connect(convolver).connect(master)

  // An echo that repeats a dotted eighth later, each repeat softer and duller.
  const echo = context.createGain()
  const echoDelay = context.createDelay(2)
  const feedback = context.createGain()
  const damping = context.createBiquadFilter()
  feedback.gain.value = 0.38
  damping.type = 'lowpass'
  damping.frequency.value = 2500
  echo.connect(echoDelay)
  echoDelay.connect(damping).connect(feedback).connect(echoDelay)
  damping.connect(master)

  const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
  const samples = noise.getChannelData(0)

  for (let index = 0; index < samples.length; index++) {
    samples[index] = Math.random() * 2 - 1
  }

  return { context, master, reverb, echo, echoDelay, noise }
}

/** Sends a note's output to the song's faders: dry, plus as much reverb and echo as asked for. */
function route(output: AudioNode, faders: Faders, reverb = 0, echo = 0) {
  const context = output.context
  output.connect(faders.dry)

  if (reverb > 0) {
    const send = context.createGain()
    send.gain.value = reverb
    output.connect(send).connect(faders.reverb)
  }

  if (echo > 0) {
    const send = context.createGain()
    send.gain.value = echo
    output.connect(send).connect(faders.echo)
  }
}

function playVoice(faders: Faders, voice: Voice, note: number, start: number, length: number, velocity: number) {
  const context = faders.dry.context as AudioContext
  const detunes = voice.detune ?? [0]
  const filter = context.createBiquadFilter()
  const envelope = context.createGain()
  const peak = (voice.gain * velocity) / Math.sqrt(detunes.length)
  const releaseStart = Math.max(start + length, start + voice.attack)
  const stopTime = releaseStart + voice.release + 0.1

  filter.type = 'lowpass'
  filter.Q.value = voice.resonance ?? 0.7

  if (voice.filterEnvelope) {
    filter.frequency.setValueAtTime(voice.cutoff * voice.filterEnvelope, start)
    filter.frequency.setTargetAtTime(voice.cutoff, start, voice.decay)
  } else {
    filter.frequency.setValueAtTime(voice.cutoff, start)
  }

  envelope.gain.setValueAtTime(0, start)
  envelope.gain.linearRampToValueAtTime(peak, start + voice.attack)
  envelope.gain.setTargetAtTime(peak * voice.sustain, start + voice.attack, voice.decay)
  envelope.gain.setTargetAtTime(0, releaseStart, voice.release / 4)

  let vibrato: GainNode | null = null

  if (voice.vibrato) {
    const wobble = context.createOscillator()
    vibrato = context.createGain()
    wobble.frequency.value = 5.2
    vibrato.gain.setValueAtTime(0, start)
    // The vibrato swells in after the note has settled, like a player would.
    vibrato.gain.linearRampToValueAtTime(voice.vibrato, start + Math.min(0.4, length))
    wobble.connect(vibrato)
    wobble.start(start)
    wobble.stop(stopTime)
  }

  for (const detune of detunes) {
    const oscillator = context.createOscillator()
    oscillator.type = voice.wave
    oscillator.frequency.value = frequencyOf(note)
    oscillator.detune.value = detune

    if (vibrato) {
      vibrato.connect(oscillator.detune)
    }

    oscillator.connect(filter)
    oscillator.start(start)
    oscillator.stop(stopTime)
  }

  filter.connect(envelope)
  route(envelope, faders, voice.reverb, voice.delay)
}

/** A pitched thump: a sine or triangle that drops in pitch and dies away. */
function drumTone(output: GainNode, start: number, wave: OscillatorType, from: number, to: number, gain: number, decay: number) {
  const context = output.context
  const oscillator = context.createOscillator()
  const envelope = context.createGain()
  oscillator.type = wave
  oscillator.frequency.setValueAtTime(from, start)
  oscillator.frequency.exponentialRampToValueAtTime(to, start + decay * 0.6)
  envelope.gain.setValueAtTime(gain, start)
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + decay)
  oscillator.connect(envelope).connect(output)
  oscillator.start(start)
  oscillator.stop(start + decay + 0.05)
}

/** A filtered hiss: snares, hats, shakers and the skin of a drum. */
function drumNoise(
  output: GainNode,
  noise: AudioBuffer,
  start: number,
  filterType: BiquadFilterType,
  frequency: number,
  gain: number,
  decay: number,
  attack = 0.001,
) {
  const context = output.context
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const envelope = context.createGain()
  source.buffer = noise
  source.playbackRate.value = 0.8 + Math.random() * 0.4
  filter.type = filterType
  filter.frequency.value = frequency
  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(gain, start + attack)
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay)
  source.connect(filter).connect(envelope).connect(output)
  source.start(start, Math.random())
  source.stop(start + attack + decay + 0.05)
}

function playDrum(faders: Faders, noise: AudioBuffer, drum: DrumId, start: number, velocity: number, reverb: number) {
  const output = faders.dry.context.createGain()
  output.gain.value = velocity
  route(output, faders, reverb)

  switch (drum) {
    case 'kick':
      drumTone(output, start, 'sine', 150, 42, 0.9, 0.32)
      drumNoise(output, noise, start, 'lowpass', 1500, 0.15, 0.02)
      break

    case 'snare':
      drumTone(output, start, 'triangle', 200, 150, 0.28, 0.1)
      drumNoise(output, noise, start, 'bandpass', 1800, 0.45, 0.18)
      break

    case 'hat':
      drumNoise(output, noise, start, 'highpass', 7500, 0.13, 0.045)
      break

    case 'tom':
      drumTone(output, start, 'sine', 115, 72, 0.6, 0.4)
      drumNoise(output, noise, start, 'lowpass', 500, 0.15, 0.1)
      break

    case 'timpani':
      drumTone(output, start, 'sine', 82, 70, 0.7, 0.8)
      drumTone(output, start, 'triangle', 164, 140, 0.1, 0.3)
      drumNoise(output, noise, start, 'lowpass', 350, 0.2, 0.15)
      break

    case 'frame':
      drumTone(output, start, 'sine', 95, 60, 0.45, 0.22)
      drumNoise(output, noise, start, 'lowpass', 900, 0.22, 0.08)
      break

    case 'shaker':
      drumNoise(output, noise, start, 'bandpass', 6000, 0.12, 0.06, 0.02)
      break
  }
}

function startSong(id: SongId, currentBus: Bus): PlayingSong {
  const { context } = currentBus
  const song = SONGS[id]
  const now = context.currentTime
  const faders: Faders = { dry: context.createGain(), reverb: context.createGain(), echo: context.createGain() }
  faders.dry.connect(currentBus.master)
  faders.reverb.connect(currentBus.reverb)
  faders.echo.connect(currentBus.echo)

  for (const fader of Object.values(faders)) {
    fader.gain.setValueAtTime(0, now)
    fader.gain.linearRampToValueAtTime(1, now + FADE_SECONDS)
  }

  // The echo follows the song's tempo: three sixteenths, a dotted eighth.
  currentBus.echoDelay.delayTime.setValueAtTime((60 / song.tempo / 4) * 3, now)

  const melodies = new Map<number, MelodyNote[][]>()
  song.tracks.forEach((track, index) => {
    if (track.type === 'melody') {
      melodies.set(
        index,
        track.bars.map((bar) => parseBar(bar).notes),
      )
    }
  })

  return { id, song, faders, melodies, bar: 0, step: 0, pass: 0, nextTime: now + 0.1 }
}

function fadeOut(song: PlayingSong) {
  const now = song.faders.dry.context.currentTime

  for (const fader of Object.values(song.faders)) {
    fader.gain.cancelScheduledValues(now)
    fader.gain.setValueAtTime(fader.gain.value, now)
    fader.gain.linearRampToValueAtTime(0, now + FADE_SECONDS)
  }

  // Held notes may ring for a while; once silent, the faders are unplugged so they can be cleaned up.
  setTimeout(() => {
    for (const fader of Object.values(song.faders)) {
      fader.disconnect()
    }
  }, (FADE_SECONDS + 4) * 1000)
}

function scheduleStep(current: PlayingSong, noise: AudioBuffer) {
  const { song, bar, step, pass, faders } = current
  const chord = song.chords[bar]
  const stepSeconds = 60 / song.tempo / 4
  const time = current.nextTime

  song.tracks.forEach((track, index) => {
    if (track.passes && !track.passes.includes(pass)) {
      return
    }

    // A little unevenness, so the parts sound played rather than printed.
    const velocity = (track.gain ?? 1) * (0.88 + Math.random() * 0.16)

    switch (track.type) {
      case 'chord': {
        if (track.pattern[step] === 'x') {
          const length = heldSteps(track.pattern, step) * stepSeconds

          for (let tone = 0; tone < chordSize(chord); tone++) {
            playVoice(faders, track.voice, chordTone(chord, track.octave, tone), time, length, velocity)
          }
        }

        break
      }

      case 'arpeggio': {
        const symbol = track.pattern[step]

        if (symbol >= '0' && symbol <= '9') {
          const length = heldSteps(track.pattern, step) * stepSeconds * 0.95
          playVoice(faders, track.voice, chordTone(chord, track.octave, Number(symbol)), time, length, velocity)
        }

        break
      }

      case 'melody': {
        const bars = current.melodies.get(index) ?? []
        const passIndex = track.passes ? track.passes.indexOf(pass) : pass
        const notes = bars[(passIndex * song.chords.length + bar) % bars.length] ?? []

        for (const note of notes) {
          if (note.step === step) {
            playVoice(faders, track.voice, note.note, time, note.steps * stepSeconds * 0.95, velocity)
          }
        }

        break
      }

      case 'drums': {
        const symbol = track.pattern[step]

        if (symbol && symbol !== '.') {
          const accent = symbol === symbol.toUpperCase() ? 1.4 : 1
          playDrum(faders, noise, track.drum, time, velocity * accent, track.reverb ?? 0.15)
        }

        break
      }
    }
  })

  current.nextTime += stepSeconds
  current.step++

  if (current.step === song.stepsPerBar) {
    current.step = 0
    current.bar++

    if (current.bar === song.chords.length) {
      current.bar = 0
      current.pass = (current.pass + 1) % song.passes
    }
  }
}

function tick() {
  const context = startedAudioContext()

  // Nothing can play until the player has clicked or pressed a key.
  if (!context) {
    return
  }

  bus ??= createBus(context)

  if (playing?.id !== wantedSong) {
    if (playing) {
      fadeOut(playing)
    }

    playing = wantedSong ? startSong(wantedSong, bus) : null
  }

  if (!playing) {
    return
  }

  // Background tabs only wake the timer once a second; rather than stutter, wait and pick up again on return.
  if (document.hidden || playing.nextTime < context.currentTime) {
    playing.nextTime = context.currentTime + 0.05
  }

  if (document.hidden) {
    return
  }

  while (playing.nextTime < context.currentTime + LOOKAHEAD_SECONDS) {
    scheduleStep(playing, bus.noise)
  }
}

/** Plays a song, fading over from the one playing now; `null` fades to silence. */
export function playMusic(song: SongId | null) {
  wantedSong = song

  if (!timer) {
    timer = setInterval(tick, TICK_MS)
  }
}

/** Music volume, from 0 to 1. */
export function setMusicVolume(next: number) {
  volume = next

  if (bus) {
    bus.master.gain.setTargetAtTime(volume * MUSIC_LEVEL, bus.context.currentTime, 0.1)
  }
}
