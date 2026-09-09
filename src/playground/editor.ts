import { basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { setDiagnostics, lintGutter } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import type { Diagnostic, Position } from './contracts';

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
  { tag: tags.keyword, color: '#bd9cce' },
  { tag: tags.string, color: '#bdcc97' },
  { tag: [tags.typeName, tags.className], color: '#e0c79a' },
  { tag: [tags.tagName, tags.attributeName], color: '#96bdcd' },
  { tag: tags.comment, color: '#626b6a' },
  { tag: tags.number, color: '#d2aa82' },
]);
const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: '#181c1c', color: '#ced3cf', fontSize: '13px' },
  '.cm-scroller': { fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace', lineHeight: '1.85' },
  '.cm-content': { padding: '24px 0', caretColor: '#c5dc99' },
  '.cm-line': { padding: '0 22px 0 10px' },
  '.cm-gutters': { backgroundColor: '#181c1c', color: '#505957', border: 'none', padding: '0 10px 0 12px' },
  '.cm-activeLineGutter, .cm-activeLine': { backgroundColor: '#202625' },
  '.cm-cursor': { borderLeftColor: '#c5dc99' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { background: '#35433b' },
  '.cm-tooltip': { background: '#252d29', border: '1px solid #414a41' },
  '.cm-panels': { background: '#222a25', color: '#d6ddcf' },
}, { dark: true });

export class ProjectEditor {
  readonly view: EditorView;
  private states = new Map<string, EditorState>();
  private active = '';
  private diagnostics: Diagnostic[] = [];
  constructor(parent: HTMLElement, private onChange: (path: string, source: string) => void, run: () => void) {
    this.view = new EditorView({ parent });
    this.run = run;
  }
  private run: () => void;
  open(path: string, source: string) {
    if (this.active) this.states.set(this.active, this.view.state);
    this.active = path;
    const state = this.states.get(path) ?? EditorState.create({ doc: source, extensions: [
      basicSetup, theme, syntaxHighlighting(highlight), lintGutter(),
      path.endsWith('.css') ? css() : path.endsWith('.btsx') ? beast : javascript({ typescript: true, jsx: path.endsWith('.tsrx') }),
      keymap.of([indentWithTab, { key: 'Mod-Enter', run: () => { this.run(); return true; } }, { key: 'Mod-s', run: () => { this.run(); return true; } }]),
      EditorView.contentAttributes.of({ 'aria-label': 'Source editor', spellcheck: 'false' }),
      EditorView.updateListener.of(update => { if (update.docChanged) this.onChange(this.active, update.state.doc.toString()); }),
    ] });
    this.view.setState(state);
    this.setDiagnostics(this.diagnostics);
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
      const line = this.view.state.doc.line(Math.min(position.line, this.view.state.doc.lines));
      const anchor = Math.min(line.to, line.from + position.column - 1);
      this.view.dispatch({ selection: { anchor }, effects: EditorView.scrollIntoView(anchor, { y: 'center' }) });
    }
    this.view.focus();
  }
  forget(path: string) { this.states.delete(path); }
  dispose() { this.view.destroy(); }
}
