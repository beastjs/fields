import type { AttrValue, Node, PresetDocument, Style, TextPart } from './types'

/**
 * The shape a preset is stored in.
 *
 * Convex rejects any document nested deeper than 16 levels, and a recursive node tree costs roughly two levels per
 * element, so a section of any real depth cannot be stored as a tree. Storing it as a flat node list — each node
 * naming its parent, the slot it fills, and its order within that slot — removes the recursion entirely: a stored
 * preset is seven levels deep no matter how deep the section is.
 *
 * Convex also does not preserve object key order, so nothing stored may encode order in its keys. Attributes are
 * therefore stored as an ordered array rather than a record, which is how `data-section` keeps its place ahead of
 * `className` on a section's root.
 *
 * The runtime model stays a tree with a record of attributes. `flattenPreset` and `inflatePreset` are exact
 * inverses, which is what `tests/studio-ir.test.ts` pins.
 */

/** Where a child sits in its parent: `children`, an `if` branch (`b0`, `b1`, …), or an `if`'s `else`. */
export type Slot = 'children' | 'else' | `b${number}`

interface StoredBase {
  id: string
  /** Absent on the root. */
  parent?: string
  slot?: Slot
  /** Index within the parent's slot. */
  order: number
}

/** One attribute, keeping the position it held in the source. */
export interface StoredAttr { name: string; value: AttrValue }

export type StoredNode =
  | (StoredBase & { type: 'element'; tag: string; domId?: string; style?: Style; attrs?: StoredAttr[]; text?: TextPart[] })
  | (StoredBase & { type: 'each'; item: string; index?: string; list: string; key: string })
  | (StoredBase & { type: 'if'; tests: string[]; hasElse?: boolean })
  | (StoredBase & { type: 'component'; name: string; attrs?: StoredAttr[] })

export interface StoredPreset extends Omit<PresetDocument, 'root'> {
  /** Every node of the tree, in document order; the root is the one with no `parent`. */
  nodes: StoredNode[]
}

/** Drops keys whose value is undefined, so a stored node carries only the fields it uses. */
const defined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T

const storeAttrs = (attrs: Record<string, AttrValue> | undefined): StoredAttr[] | undefined =>
  attrs && Object.entries(attrs).map(([name, value]) => ({ name, value }))

const readAttrs = (attrs: StoredAttr[] | undefined): Record<string, AttrValue> | undefined =>
  attrs && Object.fromEntries(attrs.map(attr => [attr.name, attr.value]))

export function flattenPreset(document: PresetDocument): StoredPreset {
  const { root, ...meta } = document
  const nodes: StoredNode[] = []

  const visit = (node: Node, parent: string | undefined, slot: Slot | undefined, order: number) => {
    const base = defined({ id: node.id, parent, slot, order })
    const descend = (children: Node[] | undefined, into: Slot) =>
      children?.forEach((child, index) => visit(child, node.id, into, index))

    if (node.type === 'element') {
      nodes.push(defined({ ...base, type: 'element', tag: node.tag, domId: node.domId, style: node.style, attrs: storeAttrs(node.attrs), text: node.text }))
      descend(node.children, 'children')
    } else if (node.type === 'component') {
      nodes.push(defined({ ...base, type: 'component', name: node.name, attrs: storeAttrs(node.attrs) }))
      descend(node.children, 'children')
    } else if (node.type === 'each') {
      nodes.push(defined({ ...base, type: 'each', item: node.item, index: node.index, list: node.list, key: node.key }))
      descend(node.children, 'children')
    } else {
      nodes.push(defined({ ...base, type: 'if', tests: node.branches.map(branch => branch.test), hasElse: node.otherwise === undefined ? undefined : true }))
      node.branches.forEach((branch, index) => descend(branch.children, `b${index}`))
      descend(node.otherwise, 'else')
    }
  }

  visit(document.root, undefined, undefined, 0)
  return { ...meta, nodes }
}

export function inflatePreset(stored: StoredPreset): PresetDocument {
  const { nodes, ...meta } = stored
  const roots = nodes.filter(node => node.parent === undefined)
  if (roots.length !== 1) throw new Error(`A stored preset needs exactly one root node; found ${roots.length}.`)

  // Children grouped by parent, then by slot, each run restored to its stored order.
  const slots = new Map<string, Map<Slot, StoredNode[]>>()
  for (const node of nodes) {
    if (node.parent === undefined) continue
    let parent = slots.get(node.parent)
    if (!parent) slots.set(node.parent, (parent = new Map()))
    const slot = node.slot ?? 'children'
    const run = parent.get(slot)
    if (run) run.push(node)
    else parent.set(slot, [node])
  }
  for (const parent of slots.values()) for (const run of parent.values()) run.sort((a, b) => a.order - b.order)

  const seen = new Set<string>()
  const build = (node: StoredNode): Node => {
    if (seen.has(node.id)) throw new Error(`Stored preset has a cycle at node "${node.id}".`)
    seen.add(node.id)
    const children = (slot: Slot) => (slots.get(node.id)?.get(slot) ?? []).map(build)

    if (node.type === 'if') {
      const branches = node.tests.map((test, index) => ({ test, children: children(`b${index}`) }))
      return defined({ type: 'if', id: node.id, branches, otherwise: node.hasElse ? children('else') : undefined })
    }
    const kids = children('children')
    if (node.type === 'each') {
      return defined({ type: 'each', id: node.id, item: node.item, index: node.index, list: node.list, key: node.key, children: kids })
    }
    if (node.type === 'component') {
      return defined({ type: 'component', id: node.id, name: node.name, attrs: readAttrs(node.attrs), children: kids.length ? kids : undefined })
    }
    return defined({ type: 'element', id: node.id, tag: node.tag, domId: node.domId, style: node.style, attrs: readAttrs(node.attrs), text: node.text, children: kids.length ? kids : undefined })
  }

  const root = build(roots[0])
  if (root.type !== 'element') throw new Error('A preset root must be an element.')
  if (seen.size !== nodes.length) throw new Error(`Stored preset has ${nodes.length - seen.size} node(s) unreachable from the root.`)
  return { ...meta, root }
}

/** The deepest nesting a value reaches. Convex refuses anything past 16, so stored presets are checked against it. */
export function depthOf(value: unknown): number {
  if (Array.isArray(value)) return 1 + Math.max(0, ...value.map(depthOf))
  if (value && typeof value === 'object') return 1 + Math.max(0, ...Object.values(value).map(depthOf))
  return 0
}

/** Convex's hard limit on document nesting. */
export const MAX_STORED_DEPTH = 16
