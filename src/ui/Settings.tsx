import { useState } from 'react'
import { ChoiceGroup } from './ChoiceGroup'
import { HowToPlay } from './HowToPlay'
import { Modal } from './Modal'
import { playSound, type SoundSettings } from './sound'
import { ThemeToggle } from './ThemeToggle'
import type { Theme } from './useTheme'

const SWITCH_LABELS = { on: 'On', off: 'Off' }

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
        <h3 className="settings__heading">Sound</h3>
        <AudioControl
          label="Sound effects"
          enabled={sound.enabled}
          volume={sound.volume}
          onChange={(enabled, volume) => onChangeSound({ ...sound, enabled, volume })}
          onRelease={() => playSound('hit')}
        />
        <AudioControl
          label="Music"
          enabled={sound.musicEnabled}
          volume={sound.musicVolume}
          onChange={(musicEnabled, musicVolume) => onChangeSound({ ...sound, musicEnabled, musicVolume })}
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
    <div className="settings__row">
      <span className="settings__label">{label}</span>
      <ChoiceGroup
        label={label}
        options={['on', 'off'] as const}
        labels={SWITCH_LABELS}
        value={enabled ? 'on' : 'off'}
        onChange={(choice) => onChange(choice === 'on', volume)}
      />
      <input
        className="settings__volume"
        type="range"
        min={0}
        max={100}
        step={5}
        value={volumePercent}
        aria-label={`${label} volume`}
        disabled={!enabled}
        onChange={(event) => onChange(enabled, Number(event.target.value) / 100)}
        onPointerUp={onRelease}
        onKeyUp={onRelease}
      />
      <span className="settings__value">{volumePercent}%</span>
    </div>
  )
}
