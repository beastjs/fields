/**
 * The preset document model: the JSON a section is stored as.
 *
 * A preset is a tree of nodes. Layout, spacing, sizing and typography live in a typed `style` object that compiles
 * to Tailwind utilities, so Design Mode can bind a drag handle to a field instead of editing a class string. Anything
 * the typed model does not cover survives verbatim in `raw`, and conditional classes survive in `dyn`, so every
 * existing section round-trips without loss.
 *
 * Behavior (`useState`, handlers, derived values) is not modelled: it stays as opaque TypeScript in `setup`, and
 * nodes reference it through expression bindings. The tree stays declarative where it matters and honest elsewhere.
 */

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export const breakpoints: Breakpoint[] = ['sm', 'md', 'lg', 'xl', '2xl']

/** A Tailwind spacing step (`4` → `1rem`), or an arbitrary CSS length written as-is (`'18px'`, `'50%'`). */
export type Length = number | string

export interface SpacingStyle {
  p?: Length; px?: Length; py?: Length; pt?: Length; pr?: Length; pb?: Length; pl?: Length
  m?: Length; mx?: Length; my?: Length; mt?: Length; mr?: Length; mb?: Length; ml?: Length
  gap?: Length; gapX?: Length; gapY?: Length
}

export interface SizeStyle {
  w?: Length; h?: Length; size?: Length
  minW?: Length; maxW?: Length; minH?: Length; maxH?: Length
}

export interface LayoutStyle {
  display?: 'block' | 'inline-block' | 'inline' | 'flex' | 'inline-flex' | 'grid' | 'inline-grid' | 'contents' | 'hidden'
  direction?: 'row' | 'row-reverse' | 'col' | 'col-reverse'
  wrap?: 'wrap' | 'wrap-reverse' | 'nowrap'
  align?: 'start' | 'end' | 'center' | 'baseline' | 'stretch'
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'
  /** `grid-cols-*`; a number for the step scale, a string for an arbitrary track list. */
  cols?: Length
  rows?: Length
  grow?: 0 | 1
  shrink?: 0 | 1
  basis?: Length
}

export interface TextStyle {
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | '8xl' | '9xl' | string
  weight?: 'thin' | 'extralight' | 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black'
  tracking?: 'tighter' | 'tight' | 'normal' | 'wide' | 'wider' | 'widest' | string
  leading?: Length
  align?: 'left' | 'center' | 'right' | 'justify'
  transform?: 'uppercase' | 'lowercase' | 'capitalize' | 'normal-case'
  wrap?: 'balance' | 'pretty' | 'nowrap'
  italic?: boolean
  truncate?: boolean
}

export interface SurfaceStyle {
  radius?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full' | string
  border?: Length
  borderT?: Length; borderR?: Length; borderB?: Length; borderL?: Length; borderX?: Length; borderY?: Length
}

export interface PositionStyle {
  position?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky'
  inset?: Length; top?: Length; right?: Length; bottom?: Length; left?: Length
  z?: Length
}

/**
 * One node's styling. Typed groups are what Design Mode edits; `raw` holds every other utility (colors, shadows,
 * gradients, transitions, state variants) in the order the author wrote them.
 */
export interface Style {
  layout?: LayoutStyle
  spacing?: SpacingStyle
  size?: SizeStyle
  text?: TextStyle
  surface?: SurfaceStyle
  position?: PositionStyle
  raw?: string[]
  /** Per-breakpoint overrides. Only the typed groups and `raw` apply; nesting does not recurse further. */
  at?: Partial<Record<Breakpoint, Omit<Style, 'at' | 'dyn'>>>
  /**
   * A TypeScript expression appended to the class list, for classes that depend on state
   * (`plan.featured ? '…' : '…'`). Preserved verbatim; Design Mode shows it but does not rewrite it.
   */
  dyn?: string
}

/** A run of template text: a literal, a `content` binding, or a `#{}` expression. */
export type TextPart =
  | { kind: 'literal'; value: string }
  | { kind: 'content'; key: string }
  | { kind: 'expr'; code: string }

/** An attribute value: a quoted literal, a `{}` expression, or a `content` binding. */
export type AttrValue =
  | { kind: 'literal'; value: string }
  | { kind: 'expr'; code: string }
  | { kind: 'content'; key: string }
  /** A valueless attribute, written bare in the source. */
  | { kind: 'flag' }
  /** Reserved for `className`: marks the slot it occupies, while its value comes from the node's `style`. */
  | { kind: 'style' }

export interface ElementNode {
  type: 'element'
  /** Stable within a document; Design Mode addresses nodes by this and the renderer emits it as `data-node`. */
  id: string
  tag: string
  /** The `#id` shorthand, kept separate so it renders in shorthand position. */
  domId?: string
  style?: Style
  /** Every attribute except `className` and the `#id` shorthand, in source order. */
  attrs?: Record<string, AttrValue>
  text?: TextPart[]
  children?: Node[]
}

/** `each item, index in list key expr`. */
export interface EachNode {
  type: 'each'
  id: string
  item: string
  index?: string
  /** The iterated expression, verbatim (`plans`, `plan.perks`, `[...partners, ...partners]`). */
  list: string
  key: string
  children: Node[]
}

/** `if test` with optional `elseif` branches and an `else`. */
export interface IfNode {
  type: 'if'
  id: string
  branches: { test: string; children: Node[] }[]
  otherwise?: Node[]
}

/** A named component rendered bare (`Topbar`), used by composed pages. */
export interface ComponentNode {
  type: 'component'
  id: string
  name: string
  attrs?: Record<string, AttrValue>
  children?: Node[]
}

export type Node = ElementNode | EachNode | IfNode | ComponentNode

/** An editable content value, surfaced as a form field and as an inline Design Mode edit target. */
export type ContentValue =
  | { type: 'text'; label: string; value: string; multiline?: boolean }
  | { type: 'link'; label: string; value: { label: string; href: string } }
  | { type: 'image'; label: string; value: { src: string; alt: string } }
  | { type: 'list'; label: string; of: 'text'; value: string[] }

export interface PresetDocument {
  schemaVersion: 1
  id: string
  /** Matches a `SectionKindId` from the catalog. */
  kind: string
  title: string
  description: string
  /** Schematic thumbnail rows; see studio/Wireframe.btsx. */
  wireframe: string[]
  /** Import statements the section needs, verbatim (`import { useState } from 'octane'`). */
  imports?: string[]
  /** The `setup` block's TypeScript, verbatim and un-indented by one level. */
  setup?: string
  content?: Record<string, ContentValue>
  root: ElementNode
}

/** A patch Design Mode applies to one node of one block, layered over the shared preset. */
export interface NodeOverride {
  style?: Style
  text?: TextPart[]
  attrs?: Record<string, AttrValue>
}

/** One section on a composed page: a preset reference plus non-destructive edits. */
export interface PageBlockDocument {
  /** Component name and stable key, as today's PageBlock. */
  name: string
  kind: string
  presetId: string
  content?: Record<string, ContentValue>
  /** Keyed by node id. */
  overrides?: Record<string, NodeOverride>
}

export interface PageDocument {
  schemaVersion: 1
  themeId?: string
  blocks: PageBlockDocument[]
}
