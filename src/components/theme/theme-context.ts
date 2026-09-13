import { createContext, useContext } from 'octane'
import type { Theme } from '../../playground/theme'

export interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === null) throw new Error('useTheme must be used within a ThemeProvider.')
  return context
}
