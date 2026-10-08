import type { Theme } from './useTheme'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'medieval', label: '🏰 Medieval' },
  { value: 'synthwave', label: '🌆 Synthwave' },
]

export function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {THEMES.map((option) => (
        <button
          key={option.value}
          role="radio"
          aria-checked={theme === option.value}
          className={`theme-toggle__option${theme === option.value ? ' theme-toggle__option--active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
