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
