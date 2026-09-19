import { z } from 'zod'
import { breakpoints } from './types'
import type { StoredNode, StoredPreset } from './storage'
import type { Node, PageDocument, PresetDocument, Style } from './types'

/**
 * Runtime validation for preset and page documents.
 *
 * Convex stores the node tree as an opaque value because its validators cannot be recursive, so this is the schema
 * of record at that boundary: every document is parsed here before it is written and after it is read. Keeping the
 * check in one place means a malformed or stale document is rejected rather than rendered into a project's source.
 */

const length = z.union([z.number(), z.string()])
const lengths = <K extends string>(...keys: K[]) =>
  z.object(Object.fromEntries(keys.map(key => [key, length.optional()])) as Record<K, z.ZodOptional<typeof length>>)

const spacing = lengths('p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'gap', 'gapX', 'gapY')
const size = lengths('w', 'h', 'size', 'minW', 'maxW', 'minH', 'maxH')
const layout = z.object({
  display: z.enum(['block', 'inline-block', 'inline', 'flex', 'inline-flex', 'grid', 'inline-grid', 'contents', 'hidden']).optional(),
  direction: z.enum(['row', 'row-reverse', 'col', 'col-reverse']).optional(),
  wrap: z.enum(['wrap', 'wrap-reverse', 'nowrap']).optional(),
  align: z.enum(['start', 'end', 'center', 'baseline', 'stretch']).optional(),
  justify: z.enum(['start', 'end', 'center', 'between', 'around', 'evenly']).optional(),
  cols: length.optional(),
  rows: length.optional(),
  grow: z.union([z.literal(0), z.literal(1)]).optional(),
  shrink: z.union([z.literal(0), z.literal(1)]).optional(),
  basis: length.optional()
})
const text = z.object({
  size: z.string().optional(),
  weight: z.enum(['thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black']).optional(),
  tracking: z.string().optional(),
  leading: length.optional(),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
  transform: z.enum(['uppercase', 'lowercase', 'capitalize', 'normal-case']).optional(),
  wrap: z.enum(['balance', 'pretty', 'nowrap']).optional(),
  italic: z.boolean().optional(),
  truncate: z.boolean().optional()
})
const surface = lengths('border', 'borderT', 'borderR', 'borderB', 'borderL', 'borderX', 'borderY').extend({ radius: z.string().optional() })
const position = lengths('inset', 'top', 'right', 'bottom', 'left', 'z').extend({
  position: z.enum(['static', 'relative', 'absolute', 'fixed', 'sticky']).optional()
})

const styleGroups = {
  layout: layout.optional(),
  spacing: spacing.optional(),
  size: size.optional(),
  text: text.optional(),
  surface: surface.optional(),
  position: position.optional(),
  raw: z.array(z.string()).optional()
}
const responsive = z.object(styleGroups)
export const styleSchema: z.ZodType<Style> = z.object({
  ...styleGroups,
  at: z.object(Object.fromEntries(breakpoints.map(key => [key, responsive.optional()]))).partial().optional(),
  dyn: z.string().optional()
})

export const textPartSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('literal'), value: z.string() }),
  z.object({ kind: z.literal('content'), key: z.string() }),
  z.object({ kind: z.literal('expr'), code: z.string() })
])
export const attrValueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('literal'), value: z.string() }),
  z.object({ kind: z.literal('expr'), code: z.string() }),
  z.object({ kind: z.literal('content'), key: z.string() }),
  z.object({ kind: z.literal('flag') }),
  z.object({ kind: z.literal('style') })
])
const attrs = z.record(z.string(), attrValueSchema)
/** Stored attributes are an ordered array: Convex would alphabetise the keys of a record and lose source order. */
const storedAttrs = z.array(z.object({ name: z.string().min(1).max(128), value: attrValueSchema })).max(64)

const id = z.string().min(1).max(64)
// The tree is recursive, so every branch resolves lazily through this one reference.
export const nodeSchema: z.ZodType<Node> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('element'),
      id,
      tag: z.string().min(1).max(64),
      domId: z.string().max(128).optional(),
      style: styleSchema.optional(),
      attrs: attrs.optional(),
      text: z.array(textPartSchema).optional(),
      children: z.array(nodeSchema).optional()
    }),
    z.object({
      type: z.literal('each'),
      id,
      item: z.string().min(1),
      index: z.string().optional(),
      list: z.string().min(1),
      key: z.string().min(1),
      children: z.array(nodeSchema)
    }),
    z.object({
      type: z.literal('if'),
      id,
      branches: z.array(z.object({ test: z.string().min(1), children: z.array(nodeSchema) })).min(1),
      otherwise: z.array(nodeSchema).optional()
    }),
    z.object({
      type: z.literal('component'),
      id,
      name: z.string().min(1).max(64),
      attrs: attrs.optional(),
      children: z.array(nodeSchema).optional()
    })
  ])
)

export const contentValueSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), label: z.string(), value: z.string(), multiline: z.boolean().optional() }),
  z.object({ type: z.literal('link'), label: z.string(), value: z.object({ label: z.string(), href: z.string() }) }),
  z.object({ type: z.literal('image'), label: z.string(), value: z.object({ src: z.string(), alt: z.string() }) }),
  z.object({ type: z.literal('list'), label: z.string(), of: z.literal('text'), value: z.array(z.string()) })
])

/** The root must be an element: a section renders one tag, not a loop or a conditional. */
const rootSchema = nodeSchema.refine((node): node is Extract<Node, { type: 'element' }> => node.type === 'element', {
  message: 'A preset root must be an element'
})

const presetMeta = {
  schemaVersion: z.literal(1),
  id: z.string().min(1).max(128),
  kind: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  wireframe: z.array(z.string()).max(24),
  imports: z.array(z.string()).max(32).optional(),
  setup: z.string().max(20000).optional(),
  content: z.record(z.string(), contentValueSchema).optional()
}

export const presetDocumentSchema: z.ZodType<PresetDocument> = z.object({
  ...presetMeta,
  root: rootSchema
}) as z.ZodType<PresetDocument>

/**
 * The stored form: a flat node list rather than a tree, because Convex refuses documents nested past 16 levels.
 * This, not `presetDocumentSchema`, is what crosses the storage boundary.
 */
const storedBase = {
  id,
  parent: z.string().min(1).max(64).optional(),
  slot: z.string().max(16).optional(),
  order: z.number().int().min(0)
}

export const storedNodeSchema: z.ZodType<StoredNode> = z.discriminatedUnion('type', [
  z.object({
    ...storedBase,
    type: z.literal('element'),
    tag: z.string().min(1).max(64),
    domId: z.string().max(128).optional(),
    style: styleSchema.optional(),
    attrs: storedAttrs.optional(),
    text: z.array(textPartSchema).optional()
  }),
  z.object({ ...storedBase, type: z.literal('each'), item: z.string().min(1), index: z.string().optional(), list: z.string().min(1), key: z.string().min(1) }),
  z.object({ ...storedBase, type: z.literal('if'), tests: z.array(z.string().min(1)).min(1), hasElse: z.boolean().optional() }),
  z.object({ ...storedBase, type: z.literal('component'), name: z.string().min(1).max(64), attrs: storedAttrs.optional() })
]) as z.ZodType<StoredNode>

export const storedPresetSchema: z.ZodType<StoredPreset> = z.object({
  ...presetMeta,
  nodes: z.array(storedNodeSchema).min(1).max(2000)
}) as z.ZodType<StoredPreset>

export const nodeOverrideSchema = z.object({
  style: styleSchema.optional(),
  text: z.array(textPartSchema).optional(),
  attrs: attrs.optional()
})

export const pageDocumentSchema: z.ZodType<PageDocument> = z.object({
  schemaVersion: z.literal(1),
  themeId: z.string().max(128).optional(),
  blocks: z.array(z.object({
    name: z.string().min(1).max(64),
    kind: z.string().min(1).max(64),
    presetId: z.string().min(1).max(128),
    content: z.record(z.string(), contentValueSchema).optional(),
    overrides: z.record(z.string(), nodeOverrideSchema).optional()
  })).max(200)
})

/** Parses an untrusted value into a preset document, throwing a readable error when it does not fit. */
export function parsePresetDocument(value: unknown): PresetDocument {
  const result = presetDocumentSchema.safeParse(value)
  if (!result.success) throw new Error(`Invalid preset document: ${z.prettifyError(result.error)}`)
  return result.data
}

/** Parses an untrusted value into a stored preset; the tree is rebuilt with `inflatePreset`. */
export function parseStoredPreset(value: unknown): StoredPreset {
  const result = storedPresetSchema.safeParse(value)
  if (!result.success) throw new Error(`Invalid stored preset: ${z.prettifyError(result.error)}`)
  return result.data
}

export function parsePageDocument(value: unknown): PageDocument {
  const result = pageDocumentSchema.safeParse(value)
  if (!result.success) throw new Error(`Invalid page document: ${z.prettifyError(result.error)}`)
  return result.data
}
