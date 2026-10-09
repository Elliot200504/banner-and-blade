/**
 * Sound effects, synthesised on the fly with the Web Audio API: no audio files to load.
 * Every sound is a few short tones and filtered noise bursts.
 */

export type SoundId =
  | 'click'
  | 'step'
  | 'fly'
  | 'swing'
  | 'hit'
  | 'shoot'
  | 'magic'
  | 'fire'
  | 'lightning'
  | 'blessing'
  | 'curse'
  | 'death'
  | 'defend'
  | 'wait'
  | 'morale'
  | 'lucky'
  | 'petrify'
  | 'regenerate'
  | 'victory'

export interface SoundSettings {
  /** Sound effects. */
  enabled: boolean
  /** From 0 to 1. */
  volume: number
  musicEnabled: boolean
  /** From 0 to 1. */
  musicVolume: number
}

let settings: SoundSettings = { enabled: true, volume: 0.6, musicEnabled: true, musicVolume: 0.5 }
let context: AudioContext | null = null
let master: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null

/** Browsers only start audio after the player interacts with the page, so the engine wakes on the first click or key. */
function unlock() {
  const audio = getAudio()

  if (audio && audio.context.state === 'suspended') {
    void audio.context.resume()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { once: true, capture: true })
  window.addEventListener('keydown', unlock, { once: true, capture: true })
}

function getAudio(): { context: AudioContext; master: GainNode } | null {
  if (!context || !master) {
    try {
      context = new AudioContext()
      master = context.createGain()
      master.connect(context.destination)
    } catch {
      // No Web Audio (old browser or test environment): the game just stays silent.
      return null
    }
  }

  master.gain.value = settings.volume

  return { context, master }
}

/** The audio context once the player has clicked or pressed a key and audio is running; null before that. */
export function startedAudioContext(): AudioContext | null {
  return context && context.state === 'running' ? context : null
}

export function configureSound(next: SoundSettings) {
  settings = next

  if (master) {
    master.gain.value = next.volume
  }
}

interface ToneOptions {
  wave: OscillatorType
  from: number
  to?: number
  duration: number
  gain: number
  delay?: number
}

/** One oscillator note, sliding from one pitch to another, with a quick attack and a fading tail. */
function tone(audio: { context: AudioContext; master: GainNode }, options: ToneOptions) {
  const { context: audioContext, master: output } = audio
  const start = audioContext.currentTime + (options.delay ?? 0)
  const end = start + options.duration
  const oscillator = audioContext.createOscillator()
  const envelope = audioContext.createGain()

  oscillator.type = options.wave
  oscillator.frequency.setValueAtTime(options.from, start)
  oscillator.frequency.exponentialRampToValueAtTime(options.to ?? options.from, end)
  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(options.gain, start + 0.008)
  envelope.gain.exponentialRampToValueAtTime(0.0001, end)
  oscillator.connect(envelope).connect(output)
  oscillator.start(start)
  oscillator.stop(end + 0.02)
}

interface NoiseOptions {
  filter: BiquadFilterType
  from: number
  to?: number
  duration: number
  gain: number
  delay?: number
}

/** A burst of white noise through a sweeping filter: thuds, whooshes, crackles and rumbles. */
function noise(audio: { context: AudioContext; master: GainNode }, options: NoiseOptions) {
  const { context: audioContext, master: output } = audio

  if (!noiseBuffer) {
    noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate, audioContext.sampleRate)
    const samples = noiseBuffer.getChannelData(0)

    for (let index = 0; index < samples.length; index++) {
      samples[index] = Math.random() * 2 - 1
    }
  }

  const start = audioContext.currentTime + (options.delay ?? 0)
  const end = start + options.duration
  const source = audioContext.createBufferSource()
  const filter = audioContext.createBiquadFilter()
  const envelope = audioContext.createGain()

  source.buffer = noiseBuffer
  filter.type = options.filter
  filter.frequency.setValueAtTime(options.from, start)
  filter.frequency.exponentialRampToValueAtTime(options.to ?? options.from, end)
  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(options.gain, start + 0.005)
  envelope.gain.exponentialRampToValueAtTime(0.0001, end)
  source.connect(filter).connect(envelope).connect(output)
  source.start(start)
  source.stop(end + 0.02)
}

/** Several notes one after another. */
function arpeggio(
  audio: { context: AudioContext; master: GainNode },
  wave: OscillatorType,
  notes: number[],
  spacing: number,
  gain: number,
) {
  notes.forEach((frequency, index) => {
    const last = index === notes.length - 1
    tone(audio, { wave, from: frequency, duration: last ? spacing * 4 : spacing * 1.6, gain, delay: index * spacing })
  })
}

const SOUNDS: Record<SoundId, (audio: { context: AudioContext; master: GainNode }) => void> = {
  click: (audio) => tone(audio, { wave: 'triangle', from: 1100, to: 900, duration: 0.04, gain: 0.08 }),
  step: (audio) => noise(audio, { filter: 'lowpass', from: 420, to: 180, duration: 0.07, gain: 0.22 }),
  fly: (audio) => noise(audio, { filter: 'bandpass', from: 300, to: 1400, duration: 0.4, gain: 0.3 }),
  swing: (audio) => noise(audio, { filter: 'highpass', from: 900, to: 3500, duration: 0.13, gain: 0.25 }),
  hit: (audio) => {
    noise(audio, { filter: 'lowpass', from: 1400, to: 300, duration: 0.14, gain: 0.55 })
    tone(audio, { wave: 'square', from: 150, to: 55, duration: 0.12, gain: 0.18 })
  },
  shoot: (audio) => {
    tone(audio, { wave: 'triangle', from: 900, to: 260, duration: 0.12, gain: 0.18 })
    noise(audio, { filter: 'highpass', from: 2500, to: 1200, duration: 0.18, gain: 0.12, delay: 0.02 })
  },
  magic: (audio) => {
    tone(audio, { wave: 'sine', from: 600, to: 1400, duration: 0.3, gain: 0.14 })
    tone(audio, { wave: 'sine', from: 900, to: 2100, duration: 0.3, gain: 0.1, delay: 0.05 })
  },
  fire: (audio) => {
    noise(audio, { filter: 'lowpass', from: 2400, to: 250, duration: 0.55, gain: 0.45 })
    tone(audio, { wave: 'sawtooth', from: 120, to: 45, duration: 0.45, gain: 0.08 })
  },
  lightning: (audio) => {
    noise(audio, { filter: 'highpass', from: 1800, duration: 0.08, gain: 0.6 })
    noise(audio, { filter: 'lowpass', from: 700, to: 90, duration: 0.6, gain: 0.5, delay: 0.05 })
  },
  blessing: (audio) => arpeggio(audio, 'sine', [523, 659, 784], 0.07, 0.14),
  curse: (audio) => arpeggio(audio, 'triangle', [392, 311, 233], 0.09, 0.16),
  death: (audio) => {
    tone(audio, { wave: 'sawtooth', from: 220, to: 40, duration: 0.45, gain: 0.12 })
    noise(audio, { filter: 'lowpass', from: 500, to: 120, duration: 0.35, gain: 0.3 })
  },
  defend: (audio) => {
    tone(audio, { wave: 'triangle', from: 1250, to: 1150, duration: 0.25, gain: 0.1 })
    noise(audio, { filter: 'bandpass', from: 3000, duration: 0.05, gain: 0.2 })
  },
  wait: (audio) => {
    tone(audio, { wave: 'sine', from: 880, duration: 0.06, gain: 0.08 })
    tone(audio, { wave: 'sine', from: 660, duration: 0.08, gain: 0.08, delay: 0.12 })
  },
  morale: (audio) => arpeggio(audio, 'triangle', [523, 659, 784, 1047], 0.06, 0.14),
  lucky: (audio) => arpeggio(audio, 'sine', [1319, 1568, 2093], 0.05, 0.1),
  petrify: (audio) => {
    noise(audio, { filter: 'lowpass', from: 900, to: 200, duration: 0.45, gain: 0.35 })
    tone(audio, { wave: 'square', from: 90, to: 50, duration: 0.4, gain: 0.08 })
  },
  regenerate: (audio) => tone(audio, { wave: 'sine', from: 400, to: 820, duration: 0.4, gain: 0.12 }),
  victory: (audio) => arpeggio(audio, 'triangle', [392, 523, 659, 784, 1047], 0.14, 0.16),
}

export function playSound(sound: SoundId) {
  if (!settings.enabled || settings.volume === 0) {
    return
  }

  const audio = getAudio()

  if (!audio || audio.context.state !== 'running') {
    return
  }

  SOUNDS[sound](audio)
}
