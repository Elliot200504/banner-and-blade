import { THEMES, type Theme } from './useTheme'

const THEME_LABELS: Record<Theme, string> = {
  default: 'Default',
  medieval: 'Medieval',
  synthwave: 'Synthwave',
}

export function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {THEMES.map((option) => (
        <button
          key={option}
          role="radio"
          aria-checked={theme === option}
          className={`theme-toggle__option${theme === option ? ' theme-toggle__option--active' : ''}`}
          onClick={() => onChange(option)}
        >
          {THEME_LABELS[option]}
        </button>
      ))}
    </div>
  )
}
