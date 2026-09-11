export type Theme = 'dark' | 'light';
export const THEME_STORAGE_KEY = 'beast-playground.theme.v1';

export function readTheme(): Theme {
  try { return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}
export function saveTheme(theme: Theme) {
  applyTheme(theme);
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Theme still works for this tab. */ }
}
