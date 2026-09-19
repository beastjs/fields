import { toStyle } from './classes'
import type { AttrValue, ElementNode, Node, PresetDocument, TextPart } from './types'

/**
 * Parses the Beast template subset the section presets use into a `PresetDocument`.
 *
 * Supported: leading imports, a `setup` block (kept verbatim as opaque TypeScript), elements with `#id` shorthand,
 * attributes with quoted or `{}` values, `#{}` text interpolation, `each … in … key …`, and `if`/`elseif`/`else`.
 * Node ids are assigned in document order, so re-parsing the same source yields the same ids and a page's
 * Design Mode overrides keep pointing at the nodes they were made against.
 */

export class ParseError extends Error {
  constructor(message: string, readonly line: number) {
    super(`${message} (line ${line + 1})`)
  }
}

const ELEMENT = /^([A-Za-z][-A-Za-z0-9]*)(#[A-Za-z][-\w]*)?/
const EACH = /^each\s+([A-Za-z_$][\w$]*)(?:\s*,\s*([A-Za-z_$][\w$]*))?\s+in\s+(.+?)\s+key\s+(.+)$/
const INDENT_STEP = 2

interface Line { indent: number; text: string; row: number }

/** Scans from `start` to the matching close of the bracket that opened it, skipping over string literals. */
function balanced(text: string, start: number, open: string, close: string, row: number): number {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (char === "'" || char === '"' || char === '`') {
      for (i++; i < text.length && text[i] !== char; i++) if (text[i] === '\\') i++
      continue
    }
    if (char === open) depth++
    else if (char === close && --depth === 0) return i
  }
  throw new ParseError(`Unbalanced "${open}"`, row)
}

/** Reads an attribute list from just past the opening `(` to just before the closing `)`. */
function parseAttrs(text: string, row: number): { attrs: Record<string, AttrValue>; classes?: string; dyn?: string } {
  const attrs: Record<string, AttrValue> = {}
  let classes: string | undefined
  let dyn: string | undefined
  let i = 0
  while (i < text.length) {
    if (/\s/.test(text[i])) { i++; continue }
    // `~` continues an attribute list onto the next line; the joiner leaves it in place.
    if (text[i] === '~') { i++; continue }
    const name = /^[A-Za-z_:@][-\w:.]*/.exec(text.slice(i))
    if (!name) throw new ParseError(`Unreadable attribute near "${text.slice(i, i + 20)}"`, row)
    i += name[0].length
    if (text[i] !== '=') { attrs[name[0]] = { kind: 'flag' }; continue }
    i++
    const quote = text[i]
    if (quote === "'" || quote === '"') {
      const end = text.indexOf(quote, i + 1)
      if (end < 0) throw new ParseError(`Unterminated string for "${name[0]}"`, row)
      const value = text.slice(i + 1, end)
      if (name[0] === 'className') { classes = value; attrs.className = { kind: 'style' } }
      else attrs[name[0]] = { kind: 'literal', value }
      i = end + 1
    } else if (quote === '{') {
      const end = balanced(text, i, '{', '}', row)
      const code = text.slice(i + 1, end)
      if (name[0] === 'className') {
        // `className={'static classes ' + (expr)}` keeps its literal prefix typed and its condition as `dyn`.
        const split = /^\s*'([^']*)'\s*\+\s*(.+)$/s.exec(code)
        if (split) { classes = split[1].trim(); dyn = split[2].trim() }
        else dyn = code.trim()
        attrs.className = { kind: 'style' }
      } else attrs[name[0]] = { kind: 'expr', code }
      i = end + 1
    } else throw new ParseError(`Attribute "${name[0]}" needs a quoted or {} value`, row)
  }
  return { attrs, classes, dyn }
}

/** Splits template text into literal runs and `#{}` expressions. */
export function parseText(text: string, row = 0): TextPart[] {
  const parts: TextPart[] = []
  let at = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '#' || text[i + 1] !== '{') continue
    const end = balanced(text, i + 1, '{', '}', row)
    if (i > at) parts.push({ kind: 'literal', value: text.slice(at, i) })
    parts.push({ kind: 'expr', code: text.slice(i + 2, end) })
    at = i = end + 1
    i--
  }
  if (at < text.length) parts.push({ kind: 'literal', value: text.slice(at) })
  return parts
}

/** Joins `~` continuation lines into the element line they belong to. */
function readLines(body: string): Line[] {
  const lines: Line[] = []
  body.split('\n').forEach((raw, row) => {
    if (!raw.trim()) return
    const indent = raw.length - raw.trimStart().length
    const text = raw.trim()
    if (text.startsWith('~') && lines.length) {
      const previous = lines[lines.length - 1]
      previous.text = `${previous.text} ${text.slice(1).trim()}`
      return
    }
    lines.push({ indent, text, row })
  })
  return lines
}

export function parsePreset(source: string, meta: Omit<PresetDocument, 'schemaVersion' | 'root' | 'imports' | 'setup'>): PresetDocument {
  const imports: string[] = []
  const setup: string[] = []
  const template: string[] = []
  let section: 'head' | 'setup' | 'template' = 'head'

  for (const raw of source.split('\n')) {
    if (section === 'head') {
      if (/^import\b/.test(raw)) { imports.push(raw.trimEnd()); continue }
      if (/^setup\s*$/.test(raw)) { section = 'setup'; continue }
      if (!raw.trim()) continue
      section = 'template'
    } else if (section === 'setup') {
      // The setup block runs until the first non-blank line back at column 0.
      if (raw.trim() && !/^\s/.test(raw)) section = 'template'
      else { setup.push(raw.replace(/^ {2}/, '').trimEnd()); continue }
    }
    template.push(raw.trimEnd())
  }

  let counter = 0
  const nextId = () => `n${++counter}`
  const lines = readLines(template.join('\n'))
  if (!lines.length) throw new ParseError('A preset needs a root element', 0)
  if (lines[0].indent !== 0) throw new ParseError('The root element must start at column 0', lines[0].row)

  /** Parses the run of lines at `indent` starting at `from`; returns the nodes and the index just past them. */
  function parseBlock(from: number, indent: number): { nodes: Node[]; next: number } {
    const nodes: Node[] = []
    let i = from
    while (i < lines.length && lines[i].indent >= indent) {
      if (lines[i].indent > indent) throw new ParseError('Unexpected indentation', lines[i].row)
      const { text, row } = lines[i]
      const children = () => parseBlock(i + 1, indent + INDENT_STEP)

      if (/^each\b/.test(text)) {
        const match = EACH.exec(text)
        if (!match) throw new ParseError(`Unreadable each: "${text}"`, row)
        const id = nextId()
        const block = children()
        nodes.push({ type: 'each', id, item: match[1], index: match[2], list: match[3], key: match[4], children: block.nodes })
        i = block.next
        continue
      }
      if (/^if\b/.test(text)) {
        const id = nextId()
        const first = children()
        const node: Extract<Node, { type: 'if' }> = { type: 'if', id, branches: [{ test: text.slice(3).trim(), children: first.nodes }] }
        i = first.next
        while (i < lines.length && lines[i].indent === indent && /^(?:elseif\b|else\s*$)/.test(lines[i].text)) {
          const branch = lines[i].text
          const block = parseBlock(i + 1, indent + INDENT_STEP)
          if (branch.startsWith('elseif')) node.branches.push({ test: branch.slice(7).trim(), children: block.nodes })
          else node.otherwise = block.nodes
          i = block.next
        }
        nodes.push(node)
        continue
      }

      const head = ELEMENT.exec(text)
      if (!head) throw new ParseError(`Unreadable element: "${text}"`, row)
      let rest = text.slice(head[0].length)
      let attrs: Record<string, AttrValue> = {}
      let classes: string | undefined
      let dyn: string | undefined
      if (rest.startsWith('(')) {
        const end = balanced(rest, 0, '(', ')', row)
        const read = parseAttrs(rest.slice(1, end), row)
        attrs = read.attrs
        classes = read.classes
        dyn = read.dyn
        rest = rest.slice(end + 1)
      }
      const id = nextId()
      // A capitalized bare name with no attributes and no text is a component reference, not an element.
      const isComponent = /^[A-Z]/.test(head[1]) && !head[2]
      const node = {
        type: isComponent ? 'component' : 'element',
        id,
        ...(isComponent ? { name: head[1] } : { tag: head[1] }),
        ...(head[2] ? { domId: head[2].slice(1) } : {}),
        ...(classes !== undefined || dyn !== undefined ? { style: toStyle(classes ?? '', dyn) } : {}),
        ...(Object.keys(attrs).length ? { attrs } : {})
      } as Node
      const content = rest.trim()
      if (content && node.type === 'element') node.text = parseText(content, row)
      else if (content) throw new ParseError(`"${head[1]}" cannot have inline text`, row)

      const block = children()
      if (block.nodes.length) (node as ElementNode).children = block.nodes
      nodes.push(node)
      i = block.next
    }
    return { nodes, next: i }
  }

  const { nodes } = parseBlock(0, 0)
  const root = nodes[0]
  if (nodes.length !== 1 || root.type !== 'element') throw new ParseError('A preset needs exactly one root element', 0)
  return {
    schemaVersion: 1,
    ...meta,
    ...(imports.length ? { imports } : {}),
    ...(setup.length ? { setup: setup.join('\n').replace(/\n+$/, '') } : {}),
    root
  }
}
