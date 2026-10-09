import { useEffect, useState } from 'react'
import { setMusicVolume } from './music'
import { configureSound, type SoundSettings } from './sound'

const STORAGE_KEY = 'banner-and-blade:sound'

const DEFAULT_SETTINGS: SoundSettings = { enabled: true, volume: 0.6, musicEnabled: true, musicVolume: 0.5 }

function loadSettings(): SoundSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<SoundSettings> | null

    if (!stored) {
      return DEFAULT_SETTINGS
    }

    return {
      enabled: typeof stored.enabled === 'boolean' ? stored.enabled : DEFAULT_SETTINGS.enabled,
      volume: typeof stored.volume === 'number' ? Math.min(1, Math.max(0, stored.volume)) : DEFAULT_SETTINGS.volume,
      musicEnabled: typeof stored.musicEnabled === 'boolean' ? stored.musicEnabled : DEFAULT_SETTINGS.musicEnabled,
      musicVolume:
        typeof stored.musicVolume === 'number' ? Math.min(1, Math.max(0, stored.musicVolume)) : DEFAULT_SETTINGS.musicVolume,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function useSoundSettings() {
  const [settings, setSettings] = useState<SoundSettings>(loadSettings)

  useEffect(() => {
    configureSound(settings)
    setMusicVolume(settings.musicVolume)

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Storage can be blocked; the setting just is not remembered then.
    }
  }, [settings])

  return [settings, setSettings] as const
}
