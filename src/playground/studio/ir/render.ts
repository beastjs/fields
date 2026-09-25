import { toClasses } from './classes'
import type { AttrValue, Node, PresetDocument, TextPart } from './types'

/**
 * Renders a `PresetDocument` back to Beast source.
 *
 * Install output is what lands in `src/sections/*.btsx`. Preview output additionally stamps each element with
 * `data-node`, which is how Fine Layout maps a hovered DOM element back to the node that produced it. Nodes inside
 * an `each` render once, so their id addresses the repeated template rather than any one iteration.
 */

export interface RenderOptions {
  /** Stamp `data-node` on every element so the preview can be inspected. */
  inspectable?: boolean
  /**
   * Namespaces the stamped ids. Node ids are unique within a preset but not across a page, so without this the
   * same id names a node in every section and an edit would reach all of them.
   */
  nodePrefix?: string
}

const INDENT = '  '
const quote = (value: string) => (value.includes("'") ? `"${value.replace(/"/g, '&quot;')}"` : `'${value}'`)

const attrText = (name: string, value: AttrValue) => {
  if (value.kind === 'flag') return name
  if (value.kind === 'expr') return `${name}={${value.code}}`
  if (value.kind === 'content') return `${name}={content.${value.key}}`
  if (value.kind === 'style') return name
  return `${name}=${quote(value.value)}`
}

const textSource = (parts: TextPart[]) =>
  parts.map(part => (part.kind === 'literal' ? part.value : part.kind === 'expr' ? `#{${part.code}}` : `#{content.${part.key}}`)).join('')

function nodeLines(node: Node, depth: number, options: RenderOptions): string[] {
  const pad = INDENT.repeat(depth)
  const nested = (children: Node[] | undefined) => (children ?? []).flatMap(child => nodeLines(child, depth + 1, options))

  if (node.type === 'each') {
    const binding = node.index ? `${node.item}, ${node.index}` : node.item
    return [`${pad}each ${binding} in ${node.list} key ${node.key}`, ...nested(node.children)]
  }
  if (node.type === 'if') {
    const lines: string[] = []
    node.branches.forEach((branch, index) => {
      lines.push(`${pad}${index === 0 ? 'if' : 'elseif'} ${branch.test}`, ...nested(branch.children))
    })
    if (node.otherwise) lines.push(`${pad}else`, ...nested(node.otherwise))
    return lines
  }

  const classText = () => {
    if (node.type !== 'element') return ''
    const classes = toClasses(node.style)
    if (node.style?.dyn) return `className={${classes ? `'${classes} ' + ` : ''}${node.style.dyn}}`
    return classes ? `className=${quote(classes)}` : ''
  }

  const attrs: string[] = []
  // `data-node` goes first so a hand-edited attribute list stays recognisable next to the installed file.
  if (options.inspectable && node.type === 'element') {
    attrs.push(`data-node='${options.nodePrefix ? `${options.nodePrefix}:` : ''}${node.id}'`)
  }
  let placed = false
  for (const [name, value] of Object.entries(node.attrs ?? {})) {
    // Older catalog documents still contain home-page placeholders. Keep them inert in both
    // preview and installed source without requiring a database reseed or changing node ids.
    if (node.type === 'element' && node.tag === 'a' && name === 'href' && value.kind === 'literal' && ['', '#', '/'].includes(value.value.trim())) {
      if (!node.attrs?.role) attrs.push("role='link'")
      if (!node.attrs?.['aria-disabled']) attrs.push("aria-disabled='true'")
      continue
    }
    if (value.kind !== 'style') { attrs.push(attrText(name, value)); continue }
    const text = classText()
    if (text) { attrs.push(text); placed = true }
  }
  if (!placed) {
    const text = classText()
    if (text) attrs.push(text)
  }

  const head = node.type === 'component' ? node.name : `${node.tag}${node.domId ? `#${node.domId}` : ''}`
  const list = attrs.length ? `(${attrs.join(' ')})` : ''
  const text = node.type === 'element' && node.text?.length ? ` ${textSource(node.text)}` : ''
  return [`${pad}${head}${list}${text}`, ...nested(node.children)]
}

/** The `.btsx` source for a preset: imports, an optional `setup` block, then the element tree. */
export function renderPreset(document: PresetDocument, options: RenderOptions = {}): string {
  const out: string[] = []
  if (document.imports?.length) out.push(...document.imports, '')
  if (document.setup) out.push('setup', ...document.setup.split('\n').map(line => (line ? `${INDENT}${line}` : '')), '')
  out.push(...nodeLines(document.root, 0, options))
  return `${out.join('\n')}\n`
}

/** Walks every node of a document in render order. */
export function* walk(node: Node): Generator<Node> {
  yield node
  const children = node.type === 'if' ? [...node.branches.flatMap(branch => branch.children), ...(node.otherwise ?? [])] : (node.children ?? [])
  for (const child of children) yield* walk(child)
}

/** Every node of a document, keyed by id. */
export const nodeIndex = (document: PresetDocument) => new Map([...walk(document.root)].map(node => [node.id, node]))
