import { DEFAULT_EDITOR_THEME, isEditorThemeId, type EditorThemeId } from './editor-themes';

export type EditorKeymap = 'default' | 'vim';
const storageKey = 'beast-playground.editor-keymap.v1';

export function readEditorKeymap(): EditorKeymap {
  try { return localStorage.getItem(storageKey) === 'vim' ? 'vim' : 'default'; }
  catch { return 'default'; }
}

export function writeEditorKeymap(keymap: EditorKeymap): void {
  // Private browsing/storage restrictions must not prevent changing the editor.
  try { localStorage.setItem(storageKey, keymap); } catch { /* Session-only preference. */ }
}

const themeStorageKey = 'beast-playground.editor-theme.v1';

export function readEditorTheme(): EditorThemeId {
  try {
    const value = localStorage.getItem(themeStorageKey);
    return isEditorThemeId(value) ? value : DEFAULT_EDITOR_THEME;
  } catch { return DEFAULT_EDITOR_THEME; }
}

export function writeEditorTheme(theme: EditorThemeId): void {
  try { localStorage.setItem(themeStorageKey, theme); } catch { /* Session-only preference. */ }
}

const lineNumbersStorageKey = 'beast-playground.editor-line-numbers.v1';

export function readEditorLineNumbers(): boolean {
  try { return localStorage.getItem(lineNumbersStorageKey) !== 'off'; }
  catch { return true; }
}

export function writeEditorLineNumbers(visible: boolean): void {
  try { localStorage.setItem(lineNumbersStorageKey, visible ? 'on' : 'off'); } catch { /* Session-only preference. */ }
}
