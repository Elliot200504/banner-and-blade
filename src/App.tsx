import { useState } from 'react'
import { Battle } from './ui/Battle'
import { StartScreen } from './ui/StartScreen'
import { ThemeToggle } from './ui/ThemeToggle'
import { useTheme } from './ui/useTheme'

export default function App() {
  const [screen, setScreen] = useState<'start' | 'battle'>('start')
  const [theme, setTheme] = useTheme()
  return (
    <>
      <header className="app-header">
        {screen === 'battle' && <span className="app-header__title">Banner &amp; Blade</span>}
        <ThemeToggle theme={theme} onChange={setTheme} />
      </header>
      {screen === 'start' ? (
        <StartScreen onStart={() => setScreen('battle')} />
      ) : (
        <Battle onMainMenu={() => setScreen('start')} />
      )}
    </>
  )
}
