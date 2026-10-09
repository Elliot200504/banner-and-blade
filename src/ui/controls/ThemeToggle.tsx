import { ChoiceGroup } from './ChoiceGroup'
import { THEMES, type Theme } from '../hooks/useTheme'

const THEME_LABELS: Record<Theme, string> = {
  default: 'Default',
  medieval: 'Medieval',
  synthwave: 'Synthwave',
}

export function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  return <ChoiceGroup label="Theme" options={THEMES} labels={THEME_LABELS} value={theme} onChange={onChange} />
}
