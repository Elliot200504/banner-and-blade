import { useEffect, useState } from 'react'

export type Theme = 'default' | 'medieval' | 'synthwave'

export const THEMES: Theme[] = ['default', 'medieval', 'synthwave']

const STORAGE_KEY = 'banner-and-blade:theme-v2'

function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    return THEMES.find((theme) => theme === stored) ?? 'default'
  } catch {
    return 'default'
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(loadTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme

    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Storage can be blocked (private mode); the theme just won't be remembered.
    }
  }, [theme])

  return [theme, setTheme] as const
}
