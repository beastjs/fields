import { basicSetup } from 'codemirror';
import { Compartment, EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { isolateHistory, indentWithTab } from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { setDiagnostics, lintGutter } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import { getCM, vim } from '@replit/codemirror-vim';
import type { Diagnostic, Position } from './contracts';
import type { EditorKeymap } from './editor-preferences';
import type { Theme } from './theme';

// A lexical highlighting mode only. Compilation and validation belong to Beast.
const beast = StreamLanguage.define({
  startState: () => ({}),
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match(/^(import|from|module|props|setup|if|else|each|key|scope|switch|case|try|catch|finally|const|let|return|type|interface)\b/)) return 'keyword';
    if (stream.match(/^(['"])(?:\\.|[^\\])*?\1/)) return 'string';
    if (stream.match(/^#[{]/)) return 'operator';
    if (stream.match(/^\.[\w-]+/)) return 'className';
    if (stream.match(/^[A-Z][\w]*/)) return 'typeName';
    if (stream.match(/^\d+/)) return 'number';
    if (stream.sol() && stream.match(/^[\w-]+/)) return 'tagName';
    if (stream.match(/^[\w-]+(?==)/)) return 'attributeName';
    stream.next();
    return null;
  },
});
const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syntax-keyword)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: [tags.typeName, tags.className], color: 'var(--syntax-type)' },
  { tag: [tags.tagName, tags.attributeName], color: 'var(--syntax-tag)' },
  { tag: tags.comment, color: 'var(--syntax-comment)' },
  { tag: tags.number, color: 'var(--syntax-number)' },
]);
const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--editor-background)', color: 'var(--text)', fontSize: '12px' },
  '.cm-scroller': { fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace', lineHeight: '1.85' },
  '.cm-content': { padding: '20px 0', caretColor: 'var(--accent)' },
  '.cm-line': { padding: '0 22px 0 10px' },
  '.cm-gutters': { backgroundColor: 'var(--editor-background)', color: 'var(--faint)', border: 'none', padding: '0 10px 0 12px' },
  '.cm-activeLineGutter, .cm-activeLine': { backgroundColor: 'var(--surface-hover)' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { background: 'var(--selection)' },
  '.cm-tooltip': { background: 'var(--panel)', border: '1px solid var(--edge)' },
  '.cm-panels': { background: 'var(--surface-toolbar)', color: 'var(--text)' },
});

export class ProjectEditor {
  readonly view: EditorView;
  private states = new Map<string, EditorState>();
  private active = '';
  private diagnostics: Diagnostic[] = [];
  private keymapCompartment = new Compartment();
  private themeCompartment = new Compartment();
  private vimExtension = vim({ status: true });
  constructor(parent: HTMLElement, private onChange: (path: string, source: string) => void, run: () => void, private keymap: EditorKeymap = 'default', private themeMode: Theme = 'dark') {
    this.view = new EditorView({ parent });
    this.run = run;
  }
  private run: () => void;
  reset(path: string, source: string) {
    this.active = '';
    this.states.clear();
    this.diagnostics = [];
    this.open(path, source);
  }
  open(path: string, source: string) {
    if (this.active) this.states.set(this.active, this.view.state);
    this.active = path;
    const state = this.states.get(path) ?? EditorState.create({ doc: source, extensions: [
      this.keymapCompartment.of(this.keymap === 'vim' ? this.vimExtension : []),
      this.themeCompartment.of(EditorView.darkTheme.of(this.themeMode === 'dark')),
      basicSetup, theme, syntaxHighlighting(highlight), lintGutter(),
      path.endsWith('.css') ? css() : path.endsWith('.btsx') ? beast : javascript({ typescript: true, jsx: path.endsWith('.tsrx') }),
      keymap.of([indentWithTab]),
      Prec.highest(keymap.of([{ key: 'Mod-Enter', run: () => { this.run(); return true; } }, { key: 'Mod-s', run: () => { this.run(); return true; } }])),
      EditorView.contentAttributes.of({ 'aria-label': 'Source editor', spellcheck: 'false' }),
      EditorView.updateListener.of(update => { if (update.docChanged) this.onChange(this.active, update.state.doc.toString()); }),
    ] });
    this.view.setState(state);
    this.bindVimWrite();
    this.setDiagnostics(this.diagnostics);
  }
  syncSource(path: string, source: string) {
    const state = path === this.active ? this.view.state : this.states.get(path);
    if (!state || state.doc.toString() === source) return;
    const transaction = { changes: { from: 0, to: state.doc.length, insert: source }, annotations: isolateHistory.of('full') };
    if (path === this.active) this.view.dispatch(transaction);
    else this.states.set(path, state.update(transaction).state);
  }
  setKeymap(keymap: EditorKeymap) {
    if (this.keymap === keymap) return;
    this.keymap = keymap;
    const effects = this.keymapCompartment.reconfigure(keymap === 'vim' ? this.vimExtension : []);
    // Reconfigure saved states as well, preserving each file's document and undo history.
    for (const [path, state] of this.states) {
      if (path !== this.active) this.states.set(path, state.update({ effects }).state);
    }
    this.view.dispatch({ effects });
    this.bindVimWrite();
  }
  setTheme(theme: Theme) {
    if (this.themeMode === theme) return;
    this.themeMode = theme;
    const effects = this.themeCompartment.reconfigure(EditorView.darkTheme.of(theme === 'dark'));
    for (const [path, state] of this.states) {
      if (path !== this.active) this.states.set(path, state.update({ effects }).state);
    }
    this.view.dispatch({ effects });
  }
  private bindVimWrite() {
    const cm = this.keymap === 'vim' ? getCM(this.view) : null;
    if (cm) cm.save = this.run;
  }
  setDiagnostics(diagnostics: Diagnostic[]) {
    this.diagnostics = diagnostics;
    const doc = this.view.state.doc;
    const offset = (position: Position) => {
      const line = doc.line(Math.max(1, Math.min(position.line, doc.lines)));
      return Math.min(line.to, line.from + Math.max(0, position.column - 1));
    };
    this.view.dispatch(setDiagnostics(this.view.state, diagnostics.filter(d => d.file === this.active).map(d => {
      const from = offset(d.start);
      return { from, to: Math.max(from, d.end ? offset(d.end) : Math.min(doc.length, from + 1)), severity: d.severity, message: d.message, source: d.source };
    })));
  }
  focus(position?: Position) {
    if (position) {
      const line = this.view.state.doc.line(Math.max(1, Math.min(position.line, this.view.state.doc.lines)));
      const anchor = Math.min(line.to, line.from + Math.max(0, position.column - 1));
      this.view.dispatch({ selection: { anchor }, effects: EditorView.scrollIntoView(anchor, { y: 'center' }) });
    }
    this.view.focus();
  }
  forget(path: string) { this.states.delete(path); }
  dispose() { this.view.destroy(); }
}
