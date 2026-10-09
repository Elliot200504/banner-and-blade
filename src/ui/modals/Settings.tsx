import { useState } from 'react'
import { HowToPlay } from './HowToPlay'
import { Modal } from './Modal'
import { playSound, type SoundSettings } from '../audio/sound'
import { ThemeToggle } from '../controls/ThemeToggle'
import type { Theme } from '../hooks/useTheme'

interface SettingsProps {
  theme: Theme
  onChangeTheme: (theme: Theme) => void
  sound: SoundSettings
  onChangeSound: (sound: SoundSettings) => void
  onClose: () => void
}

export function Settings({ theme, onChangeTheme, sound, onChangeSound, onClose }: SettingsProps) {
  const [showRules, setShowRules] = useState(false)

  if (showRules) {
    return (
      <Modal title="How to play" onClose={onClose} className="rules">
        <HowToPlay />
        <div className="modal__buttons rules__back">
          <button className="button button--secondary" onClick={() => setShowRules(false)} autoFocus>
            Back to settings
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Settings" onClose={onClose} className="settings">
      <section className="settings__section">
        <AudioControl
          label="Music"
          enabled={sound.musicEnabled}
          volume={sound.musicVolume}
          onChange={(musicEnabled, musicVolume) => onChangeSound({ ...sound, musicEnabled, musicVolume })}
        />
        <AudioControl
          label="SFX"
          enabled={sound.enabled}
          volume={sound.volume}
          onChange={(enabled, volume) => onChangeSound({ ...sound, enabled, volume })}
          onRelease={() => playSound('hit')}
        />
      </section>

      <section className="settings__section">
        <h3 className="settings__heading">Theme</h3>
        <ThemeToggle theme={theme} onChange={onChangeTheme} />
      </section>

      <section className="settings__section">
        <h3 className="settings__heading">Help</h3>
        <button className="button button--secondary" onClick={() => setShowRules(true)}>
          How to play
        </button>
      </section>
    </Modal>
  )
}

interface AudioControlProps {
  label: string
  enabled: boolean
  volume: number
  onChange: (enabled: boolean, volume: number) => void
  /** Called when the slider is let go, to play a sample at the new volume. */
  onRelease?: () => void
}

function AudioControl({ label, enabled, volume, onChange, onRelease }: AudioControlProps) {
  const volumePercent = Math.round(volume * 100)

  return (
    <div className="settings__audio">
      <span className="settings__audio-label">{label}</span>
      <div className="settings__row">
        <button
          className="button button--secondary settings__mute"
          aria-pressed={enabled}
          aria-label={`${label} ${enabled ? 'on' : 'off'}`}
          title={enabled ? `Turn ${label} off` : `Turn ${label} on`}
          onClick={() => onChange(!enabled, volume)}
        >
          <SpeakerIcon muted={!enabled} />
        </button>
        {/* Dragging the volume while muted turns the sound back on. */}
        <input
          className={`settings__volume${enabled ? '' : ' settings__volume--muted'}`}
          type="range"
          min={0}
          max={100}
          step={5}
          value={volumePercent}
          aria-label={`${label} volume`}
          onChange={(event) => onChange(true, Number(event.target.value) / 100)}
          onPointerUp={onRelease}
          onKeyUp={onRelease}
        />
        <span className="settings__value">{volumePercent}%</span>
      </div>
    </div>
  )
}

/** A standard speaker icon: with sound waves when on, crossed out when muted. */
function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      {muted ? (
        <path d="M23 9l-6 6M17 9l6 6" />
      ) : (
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
      )}
    </svg>
  )
}
