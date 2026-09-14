import { EditorView } from '@codemirror/view'
import type { Theme } from './theme'

export interface EditorPalette {
  keyword: string
  string: string
  type: string
  tag: string
  comment: string
  number: string
  attribute: string
  function: string
  selection: string
  cursor: string
  activeLine: string
}

export interface EditorThemeDefinition {
  id: string
  label: string
  dark: EditorPalette
  light: EditorPalette
}

export const editorThemes = [
  {
    id: 'github',
    label: 'GitHub',
    dark: {
      keyword: '#ff7b72', string: '#a5d6ff', type: '#ffa657', tag: '#7ee787', comment: '#8b949e',
      number: '#79c0ff', attribute: '#79c0ff', function: '#d2a8ff',
      selection: '#264f78', cursor: '#58a6ff', activeLine: '#6e76811a'
    },
    light: {
      keyword: '#cf222e', string: '#0a3069', type: '#953800', tag: '#116329', comment: '#6e7781',
      number: '#0550ae', attribute: '#0550ae', function: '#8250df',
      selection: '#add6ff', cursor: '#0969da', activeLine: '#eaeef280'
    }
  },
  {
    id: 'beast',
    label: 'Beast',
    dark: {
      keyword: '#baa6c4', string: '#b3bb9e', type: '#d0b18c', tag: '#a5b6bd', comment: '#8c8c86',
      number: '#ee9b68', attribute: '#c4a79f', function: '#9fc2b1',
      selection: '#75503b', cursor: '#e8a471', activeLine: '#343434'
    },
    light: {
      keyword: '#805183', string: '#526c32', type: '#8e581e', tag: '#3e6878', comment: '#79816e',
      number: '#a85124', attribute: '#8a4f47', function: '#2d6b5a',
      selection: '#ecd5b9', cursor: '#c64d18', activeLine: '#eeebe2'
    }
  },
  {
    id: 'catppuccin',
    label: 'Catppuccin',
    dark: {
      keyword: '#cba6f7', string: '#a6e3a1', type: '#f9e2af', tag: '#89b4fa', comment: '#7f849c',
      number: '#fab387', attribute: '#f5c2e7', function: '#89dceb',
      selection: '#45475a', cursor: '#f5e0dc', activeLine: '#31324466'
    },
    light: {
      keyword: '#8839ef', string: '#40a02b', type: '#df8e1d', tag: '#1e66f5', comment: '#8c8fa1',
      number: '#fe640b', attribute: '#ea76cb', function: '#04a5e5',
      selection: '#ccd0da', cursor: '#dc8a78', activeLine: '#e6e9ef99'
    }
  },
  {
    id: 'solarized',
    label: 'Solarized',
    dark: {
      keyword: '#859900', string: '#2aa198', type: '#b58900', tag: '#268bd2', comment: '#839496',
      number: '#d33682', attribute: '#cb4b16', function: '#268bd2',
      selection: '#274642', cursor: '#93a1a1', activeLine: '#073642'
    },
    light: {
      keyword: '#859900', string: '#2aa198', type: '#b58900', tag: '#268bd2', comment: '#839496',
      number: '#d33682', attribute: '#cb4b16', function: '#268bd2',
      selection: '#eee8d5', cursor: '#586e75', activeLine: '#eee8d580'
    }
  },
  {
    id: 'gruvbox',
    label: 'Gruvbox',
    dark: {
      keyword: '#fb4934', string: '#b8bb26', type: '#fabd2f', tag: '#83a598', comment: '#928374',
      number: '#d3869b', attribute: '#8ec07c', function: '#fe8019',
      selection: '#504945', cursor: '#ebdbb2', activeLine: '#3c383680'
    },
    light: {
      keyword: '#9d0006', string: '#79740e', type: '#b57614', tag: '#076678', comment: '#928374',
      number: '#8f3f71', attribute: '#427b58', function: '#af3a03',
      selection: '#d5c4a1', cursor: '#3c3836', activeLine: '#ebdbb280'
    }
  }
] as const satisfies readonly EditorThemeDefinition[]

export type EditorThemeId = (typeof editorThemes)[number]['id']
export const DEFAULT_EDITOR_THEME: EditorThemeId = 'github'

export function isEditorThemeId(value: unknown): value is EditorThemeId {
  return editorThemes.some((theme) => theme.id === value)
}

/** Syntax colors are exposed as custom properties so the shared HighlightStyle stays static. */
export function editorThemeExtension(id: EditorThemeId, mode: Theme) {
  const definition = editorThemes.find((theme) => theme.id === id) ?? editorThemes[0]
  const palette: EditorPalette = definition[mode]
  return [
    EditorView.darkTheme.of(mode === 'dark'),
    EditorView.theme({
      '&': {
        '--syntax-keyword': palette.keyword,
        '--syntax-string': palette.string,
        '--syntax-type': palette.type,
        '--syntax-tag': palette.tag,
        '--syntax-comment': palette.comment,
        '--syntax-number': palette.number,
        '--syntax-attribute': palette.attribute,
        '--syntax-function': palette.function
      },
      '.cm-content': { caretColor: palette.cursor },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: palette.cursor },
      '.cm-activeLineGutter, .cm-activeLine': { backgroundColor: palette.activeLine },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        background: palette.selection
      }
    })
  ]
}
