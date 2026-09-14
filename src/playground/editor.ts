import { indentWithTab, isolateHistory } from '@codemirror/commands'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { lintGutter, setDiagnostics } from '@codemirror/lint'
import { Compartment, EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { getCM, vim } from '@replit/codemirror-vim'
import { basicSetup } from 'codemirror'
import { btsx } from './btsx-language'
import type { Diagnostic, Position } from './contracts'
import type { EditorKeymap } from './editor-preferences'
import { DEFAULT_EDITOR_THEME, editorThemeExtension, type EditorThemeId } from './editor-themes'
import { indentGuides } from './indent-guides'
import type { Theme } from './theme'

const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.self, tags.special(tags.punctuation)], color: 'var(--syntax-keyword)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: tags.typeName, color: 'var(--syntax-type)' },
  { tag: tags.definition(tags.typeName), color: 'var(--syntax-type)', fontWeight: '600' },
  { tag: tags.tagName, color: 'var(--syntax-tag)' },
  { tag: [tags.attributeName, tags.className], color: 'var(--syntax-attribute)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--syntax-function)' },
  { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
  { tag: [tags.number, tags.atom, tags.bool, tags.null, tags.character], color: 'var(--syntax-number)' }
])
const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--)', color: 'var(--text)', fontSize: '13px' },
  '.cm-scroller': { fontFamily: 'IOS, Consolas, "Liberation Mono", monospace', lineHeight: '1.75' },
  '.cm-content': {
    padding: '10px 0',
    '--indent-guide': 'var(--)',
    '--indent-guide-active': 'var(--)',
    '--indent-guide-offset': '2px'
  },
  '.cm-line': { padding: '0 0px 0 0px' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--faint)',
    border: 'none',
    padding: '0 0px 0 0px'
  },
  // Lint hovers and completions float over code, so they need an opaque surface to stay legible.
  '.cm-tooltip': {
    backgroundColor: 'var(--panel)',
    color: 'var(--text)',
    border: '1px solid var(--edge-strong)',
    borderRadius: '5px',
    boxShadow: '0 8px 24px #0006'
  },
  '.cm-panels': { background: 'transparent', color: 'var(--text)' },
  '.cm-vim-panel': { font: '10px/1.8 var(--mono)', color: 'var(--brand)', padding: '2px 12px !important' }
})
// basicSetup always installs the line-number gutter; hide it rather than rebuilding the setup.
const hiddenLineNumbers = EditorView.theme({ '.cm-gutters .cm-gutter.cm-lineNumbers': { display: 'none !important' } })
const lineNumbersExtension = (visible: boolean) => (visible ? [] : hiddenLineNumbers)

export class ProjectEditor {
  readonly view: EditorView
  private states = new Map<string, EditorState>()
  private active = ''
  private diagnostics: Diagnostic[] = []
  private keymapCompartment = new Compartment()
  private themeCompartment = new Compartment()
  private lineNumbersCompartment = new Compartment()
  private vimExtension = vim({ status: true })
  constructor(
    parent: HTMLElement,
    private onChange: (path: string, source: string) => void,
    run: () => void,
    private keymap: EditorKeymap = 'default',
    private themeMode: Theme = 'dark',
    private editorTheme: EditorThemeId = DEFAULT_EDITOR_THEME,
    private lineNumbers = true
  ) {
    this.view = new EditorView({ parent })
    this.run = run
  }
  private run: () => void
  reset(path: string, source: string) {
    this.active = ''
    this.states.clear()
    this.diagnostics = []
    this.open(path, source)
  }
  open(path: string, source: string) {
    if (this.active) this.states.set(this.active, this.view.state)
    this.active = path
    const state =
      this.states.get(path) ??
      EditorState.create({
        doc: source,
        extensions: [
          this.keymapCompartment.of(this.keymap === 'vim' ? this.vimExtension : []),
          this.themeCompartment.of(editorThemeExtension(this.editorTheme, this.themeMode)),
          basicSetup,
          this.lineNumbersCompartment.of(lineNumbersExtension(this.lineNumbers)),
          theme,
          syntaxHighlighting(highlight),
          lintGutter(),
          indentGuides,
          path.endsWith('.css')
            ? css()
            : path.endsWith('.btsx')
              ? btsx
              : javascript({ typescript: true, jsx: path.endsWith('.tsrx') }),
          keymap.of([indentWithTab]),
          Prec.highest(
            keymap.of([
              {
                key: 'Mod-Enter',
                run: () => {
                  this.run()
                  return true
                }
              },
              {
                key: 'Mod-s',
                run: () => {
                  this.run()
                  return true
                }
              }
            ])
          ),
          EditorView.contentAttributes.of({ 'aria-label': 'Source editor', spellcheck: 'false' }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) this.onChange(this.active, update.state.doc.toString())
          })
        ]
      })
    this.view.setState(state)
    this.bindVimWrite()
    this.setDiagnostics(this.diagnostics)
  }
  syncSource(path: string, source: string) {
    const state = path === this.active ? this.view.state : this.states.get(path)
    if (!state || state.doc.toString() === source) return
    const transaction = {
      changes: { from: 0, to: state.doc.length, insert: source },
      annotations: isolateHistory.of('full')
    }
    if (path === this.active) this.view.dispatch(transaction)
    else this.states.set(path, state.update(transaction).state)
  }
  setKeymap(keymap: EditorKeymap) {
    if (this.keymap === keymap) return
    this.keymap = keymap
    const effects = this.keymapCompartment.reconfigure(keymap === 'vim' ? this.vimExtension : [])
    // Reconfigure saved states as well, preserving each file's document and undo history.
    for (const [path, state] of this.states) {
      if (path !== this.active) this.states.set(path, state.update({ effects }).state)
    }
    this.view.dispatch({ effects })
    this.bindVimWrite()
  }
  setTheme(theme: Theme, editorTheme: EditorThemeId = this.editorTheme) {
    if (this.themeMode === theme && this.editorTheme === editorTheme) return
    this.themeMode = theme
    this.editorTheme = editorTheme
    const effects = this.themeCompartment.reconfigure(editorThemeExtension(editorTheme, theme))
    for (const [path, state] of this.states) {
      if (path !== this.active) this.states.set(path, state.update({ effects }).state)
    }
    this.view.dispatch({ effects })
  }
  setLineNumbers(lineNumbers: boolean) {
    if (this.lineNumbers === lineNumbers) return
    this.lineNumbers = lineNumbers
    const effects = this.lineNumbersCompartment.reconfigure(lineNumbersExtension(lineNumbers))
    for (const [path, state] of this.states) {
      if (path !== this.active) this.states.set(path, state.update({ effects }).state)
    }
    this.view.dispatch({ effects })
  }
  private bindVimWrite() {
    const cm = this.keymap === 'vim' ? getCM(this.view) : null
    if (cm) cm.save = this.run
  }
  setDiagnostics(diagnostics: Diagnostic[]) {
    this.diagnostics = diagnostics
    const doc = this.view.state.doc
    const offset = (position: Position) => {
      const line = doc.line(Math.max(1, Math.min(position.line, doc.lines)))
      return Math.min(line.to, line.from + Math.max(0, position.column - 1))
    }
    this.view.dispatch(
      setDiagnostics(
        this.view.state,
        diagnostics
          .filter((d) => d.file === this.active)
          .map((d) => {
            const from = offset(d.start)
            return {
              from,
              to: Math.max(from, d.end ? offset(d.end) : Math.min(doc.length, from + 1)),
              severity: d.severity,
              message: d.message,
              source: d.source
            }
          })
      )
    )
  }
  focus(position?: Position) {
    if (position) {
      const line = this.view.state.doc.line(Math.max(1, Math.min(position.line, this.view.state.doc.lines)))
      const anchor = Math.min(line.to, line.from + Math.max(0, position.column - 1))
      this.view.dispatch({ selection: { anchor }, effects: EditorView.scrollIntoView(anchor, { y: 'center' }) })
    }
    this.view.focus()
  }
  forget(path: string) {
    this.states.delete(path)
  }
  dispose() {
    this.view.destroy()
  }
}
