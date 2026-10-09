import { useEffect, useState } from 'react'

export type Theme = 'medieval' | 'synthwave'

const STORAGE_KEY = 'banner-and-blade:theme'

function loadTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'synthwave' ? 'synthwave' : 'medieval'
  } catch {
    return 'medieval'
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
