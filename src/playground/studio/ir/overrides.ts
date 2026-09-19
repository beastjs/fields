import type { Breakpoint, Node, NodeOverride, PresetDocument, Style } from './types'

/**
 * Design Mode edits as non-destructive patches.
 *
 * A preset is shared and read-only, so an edit made in the preview never touches it. Instead each block carries
 * overrides keyed by node id, and the source a block renders is the preset with those patches applied. Clearing an
 * override restores the preset exactly, which is what makes the whole feature safe to experiment in.
 *
 * Nodes inside an `each` appear once in the tree and many times in the DOM, so an override on one addresses the
 * repeated template — editing one card's padding changes every card, which is what the layout means.
 */

const GROUPS = ['layout', 'spacing', 'size', 'text', 'surface', 'position'] as const

/** Merges a patch over a style, field by field within each group. `undefined` leaves a field alone. */
export function mergeStyle(base: Style | undefined, patch: Style | undefined): Style | undefined {
  if (!patch) return base
  if (!base) return patch
  const out: Style = { ...base }

  for (const group of GROUPS) {
    const over = patch[group]
    if (!over) continue
    const merged = { ...(base[group] ?? {}), ...over } as Record<string, unknown>
    // A field set to null in a patch is a removal, which is how a handle drag back to nothing clears it.
    for (const [key, value] of Object.entries(over as Record<string, unknown>)) {
      if (value === null || value === undefined) delete merged[key]
    }
    if (Object.keys(merged).length) (out as Record<string, unknown>)[group] = merged
    else delete (out as Record<string, unknown>)[group]
  }

  if (patch.raw !== undefined) out.raw = patch.raw
  if (patch.dyn !== undefined) out.dyn = patch.dyn
  if (patch.at) {
    const at: Partial<Record<Breakpoint, Omit<Style, 'at' | 'dyn'>>> = { ...(base.at ?? {}) }
    for (const [breakpoint, group] of Object.entries(patch.at) as [Breakpoint, Style][]) {
      at[breakpoint] = mergeStyle(at[breakpoint], group) as Omit<Style, 'at' | 'dyn'>
    }
    out.at = at
  }
  return out
}

const patchNode = (node: Node, override: NodeOverride): Node => {
  if (node.type !== 'element' && node.type !== 'component') return node
  const next = { ...node } as Extract<Node, { type: 'element' | 'component' }>
  if (override.attrs) next.attrs = { ...(next.attrs ?? {}), ...override.attrs }
  if (next.type === 'element') {
    if (override.style) next.style = mergeStyle(next.style, override.style)
    if (override.text) next.text = override.text
  }
  return next
}

/** The document a block actually renders: its preset with this block's overrides applied. */
export function applyOverrides(document: PresetDocument, overrides: Record<string, NodeOverride> | undefined): PresetDocument {
  if (!overrides || !Object.keys(overrides).length) return document

  const visit = (node: Node): Node => {
    const override = overrides[node.id]
    const patched = override ? patchNode(node, override) : node
    if (patched.type === 'if') {
      return {
        ...patched,
        branches: patched.branches.map(branch => ({ ...branch, children: branch.children.map(visit) })),
        ...(patched.otherwise ? { otherwise: patched.otherwise.map(visit) } : {})
      }
    }
    if (patched.children?.length) return { ...patched, children: patched.children.map(visit) }
    return patched
  }

  const root = visit(document.root)
  return root === document.root ? document : { ...document, root: root as PresetDocument['root'] }
}

/** Adds or replaces one node's override, dropping it entirely when the patch empties it. */
export function setNodeOverride(
  overrides: Record<string, NodeOverride> | undefined,
  nodeId: string,
  patch: NodeOverride
): Record<string, NodeOverride> {
  const current = overrides?.[nodeId]
  const next: NodeOverride = {
    ...current,
    ...patch,
    ...(patch.style ? { style: mergeStyle(current?.style, patch.style) } : {})
  }
  const out = { ...overrides }
  if (isEmptyOverride(next)) delete out[nodeId]
  else out[nodeId] = next
  return out
}

export function clearNodeOverride(overrides: Record<string, NodeOverride> | undefined, nodeId: string) {
  if (!overrides?.[nodeId]) return overrides ?? {}
  const out = { ...overrides }
  delete out[nodeId]
  return out
}

const isEmptyStyle = (style: Style | undefined): boolean =>
  !style || Object.values(style).every(value => value === undefined || (typeof value === 'object' && !Object.keys(value).length))

const isEmptyOverride = (override: NodeOverride) =>
  isEmptyStyle(override.style) && !override.text?.length && !Object.keys(override.attrs ?? {}).length

/** How many nodes a block has edited, for the studio to show and to offer a reset. */
export const overrideCount = (overrides: Record<string, NodeOverride> | undefined) => Object.keys(overrides ?? {}).length
