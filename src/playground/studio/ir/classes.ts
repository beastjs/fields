import { breakpoints, type Breakpoint, type Length, type Style } from './types'

/**
 * The two-way bridge between a Tailwind class list and the typed `Style` model.
 *
 * `toStyle` classifies every utility Design Mode needs a handle for and keeps the rest, in source order, in `raw`.
 * `toClasses` inverts it. Values are stored exactly as they appear after the utility's dash (`4`, `4xl`, `[42rem]`),
 * so the pair is lossless for any class list: no utility is dropped, invented, or rewritten.
 */

const BREAKPOINT = new Set<string>(breakpoints)
const NUMERIC = /^-?\d+(?:\.\d+)?$/

const parseLength = (raw: string): Length => (NUMERIC.test(raw) ? Number(raw) : raw)
/** `4` → `p-4`, `-4` → `-p-4`, `[42rem]` → `max-w-[42rem]`, `-[2px]` → `-mt-[2px]`. */
const lengthClass = (prefix: string, value: Length) => {
  const raw = String(value)
  return raw.startsWith('-') ? `-${prefix}-${raw.slice(1)}` : `${prefix}-${raw}`
}

const SPACING: Record<string, keyof NonNullable<Style['spacing']>> = {
  p: 'p', px: 'px', py: 'py', pt: 'pt', pr: 'pr', pb: 'pb', pl: 'pl',
  m: 'm', mx: 'mx', my: 'my', mt: 'mt', mr: 'mr', mb: 'mb', ml: 'ml',
  gap: 'gap', 'gap-x': 'gapX', 'gap-y': 'gapY'
}
const SIZE: Record<string, keyof NonNullable<Style['size']>> = {
  w: 'w', h: 'h', size: 'size', 'min-w': 'minW', 'max-w': 'maxW', 'min-h': 'minH', 'max-h': 'maxH'
}
const POSITION_LENGTH: Record<string, keyof NonNullable<Style['position']>> = {
  inset: 'inset', top: 'top', right: 'right', bottom: 'bottom', left: 'left', z: 'z'
}
const DISPLAY = new Set(['block', 'inline-block', 'inline', 'flex', 'inline-flex', 'grid', 'inline-grid', 'contents', 'hidden'])
const PLACEMENT = new Set(['static', 'relative', 'absolute', 'fixed', 'sticky'])
const ALIGN: Record<string, string> = { 'items-start': 'start', 'items-end': 'end', 'items-center': 'center', 'items-baseline': 'baseline', 'items-stretch': 'stretch' }
const JUSTIFY: Record<string, string> = { 'justify-start': 'start', 'justify-end': 'end', 'justify-center': 'center', 'justify-between': 'between', 'justify-around': 'around', 'justify-evenly': 'evenly' }
const DIRECTION: Record<string, string> = { 'flex-row': 'row', 'flex-row-reverse': 'row-reverse', 'flex-col': 'col', 'flex-col-reverse': 'col-reverse' }
const WRAP: Record<string, string> = { 'flex-wrap': 'wrap', 'flex-wrap-reverse': 'wrap-reverse', 'flex-nowrap': 'nowrap' }
const TEXT_ALIGN = new Set(['left', 'center', 'right', 'justify'])
const TEXT_WRAP = new Set(['balance', 'pretty', 'nowrap', 'wrap'])
const TEXT_SIZE = /^(?:xs|sm|base|lg|xl|[2-9]xl)$/
const WEIGHT = new Set(['thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black'])
const TRANSFORM: Record<string, string> = { uppercase: 'uppercase', lowercase: 'lowercase', capitalize: 'capitalize', 'normal-case': 'normal-case' }
const BORDER_SIDE: Record<string, keyof NonNullable<Style['surface']>> = { t: 'borderT', r: 'borderR', b: 'borderB', l: 'borderL', x: 'borderX', y: 'borderY' }
/** A bare `rounded` / `border` carries Tailwind's default step; this stands in for it and renders back bare. */
const DEFAULT_STEP = 'DEFAULT'

/** Every utility whose value is a length, longest prefix first. */
const LENGTH_PREFIXES: [prefix: string, group: 'spacing' | 'size' | 'position', key: string][] = [
  ...Object.entries(SPACING).map(([prefix, key]) => [prefix, 'spacing', key] as const),
  ...Object.entries(SIZE).map(([prefix, key]) => [prefix, 'size', key] as const),
  ...Object.entries(POSITION_LENGTH).map(([prefix, key]) => [prefix, 'position', key] as const)
].sort((a, b) => b[0].length - a[0].length) as [string, 'spacing' | 'size' | 'position', string][]

type Group = Omit<Style, 'at' | 'dyn'>
const set = <K extends keyof Group>(style: Group, group: K, key: string, value: unknown) => {
  const bucket = (style[group] ??= {} as Group[K]) as unknown as Record<string, unknown>
  bucket[key] = value
}

/** Classifies one utility into `style`, or returns false to leave it in `raw`. */
function classify(token: string, style: Group): boolean {
  // A leading `-` negates the utility, not the value: `-mt-4` is `mt: -4`.
  const negative = token.startsWith('-')
  const body = negative ? token.slice(1) : token

  if (!negative) {
    if (DISPLAY.has(body)) return set(style, 'layout', 'display', body), true
    if (PLACEMENT.has(body)) return set(style, 'position', 'position', body), true
    if (ALIGN[body]) return set(style, 'layout', 'align', ALIGN[body]), true
    if (JUSTIFY[body]) return set(style, 'layout', 'justify', JUSTIFY[body]), true
    if (DIRECTION[body]) return set(style, 'layout', 'direction', DIRECTION[body]), true
    if (WRAP[body]) return set(style, 'layout', 'wrap', WRAP[body]), true
    if (TRANSFORM[body]) return set(style, 'text', 'transform', TRANSFORM[body]), true
    if (body === 'italic') return set(style, 'text', 'italic', true), true
    if (body === 'truncate') return set(style, 'text', 'truncate', true), true
    if (body === 'grow' || body === 'shrink') return set(style, 'layout', body, 1), true
    if (body === 'grow-0' || body === 'shrink-0') return set(style, 'layout', body.slice(0, -2), 0), true
    if (body === 'rounded') return set(style, 'surface', 'radius', DEFAULT_STEP), true
    if (body === 'border') return set(style, 'surface', 'border', DEFAULT_STEP), true

    const rounded = /^rounded-(.+)$/.exec(body)
    // Per-corner radii (`rounded-t-lg`) stay raw: Design Mode edits one radius, not four.
    if (rounded && !/^(?:t|r|b|l|tl|tr|br|bl|s|e|ss|se|es|ee)(?:-|$)/.test(rounded[1])) {
      return set(style, 'surface', 'radius', rounded[1]), true
    }
    const borderSide = /^border-([trblxy])(?:-(\d+))?$/.exec(body)
    if (borderSide) return set(style, 'surface', BORDER_SIDE[borderSide[1]], borderSide[2] ? Number(borderSide[2]) : DEFAULT_STEP), true
    const borderWidth = /^border-(\d+)$/.exec(body)
    if (borderWidth) return set(style, 'surface', 'border', Number(borderWidth[1])), true

    const text = /^text-(.+)$/.exec(body)
    if (text) {
      const value = text[1]
      if (TEXT_ALIGN.has(value)) return set(style, 'text', 'align', value), true
      if (TEXT_WRAP.has(value)) return set(style, 'text', 'wrap', value), true
      // `text-[10px]` and `text-[#fff]` are indistinguishable here, so arbitrary values stay raw.
      if (TEXT_SIZE.test(value)) return set(style, 'text', 'size', value), true
      return false
    }
    const font = /^font-(.+)$/.exec(body)
    if (font && WEIGHT.has(font[1])) return set(style, 'text', 'weight', font[1]), true
    const tracking = /^tracking-(.+)$/.exec(body)
    if (tracking) return set(style, 'text', 'tracking', tracking[1]), true
    const leading = /^leading-(.+)$/.exec(body)
    if (leading) return set(style, 'text', 'leading', parseLength(leading[1])), true
    const cols = /^grid-(cols|rows)-(.+)$/.exec(body)
    if (cols) return set(style, 'layout', cols[1] === 'cols' ? 'cols' : 'rows', parseLength(cols[2])), true
    const basis = /^basis-(.+)$/.exec(body)
    if (basis) return set(style, 'layout', 'basis', parseLength(basis[1])), true
  }

  // Longest prefix wins, so `gap-x-6` is not read as `gap` with the value `x-6`.
  for (const [prefix, group, key] of LENGTH_PREFIXES) {
    if (!body.startsWith(`${prefix}-`)) continue
    const rest = body.slice(prefix.length + 1)
    const value = negative ? `-${rest}` : rest
    set(style, group, key, NUMERIC.test(value) ? Number(value) : value)
    return true
  }
  return false
}

/** Parses a class list into a `Style`; breakpoint-prefixed utilities land in `at`, everything unclassified in `raw`. */
export function toStyle(classes: string, dyn?: string): Style {
  const style: Style = {}
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    const colon = token.indexOf(':')
    const prefix = colon > 0 ? token.slice(0, colon) : ''
    // Only a leading breakpoint routes to `at`; state variants (`hover:`, `dark:`) keep their token and stay raw.
    const target: Group = BREAKPOINT.has(prefix) ? ((style.at ??= {})[prefix as Breakpoint] ??= {}) : style
    const utility = BREAKPOINT.has(prefix) ? token.slice(colon + 1) : token
    if (utility.includes(':') || !classify(utility, target)) (target.raw ??= []).push(utility)
  }
  if (dyn) style.dyn = dyn
  return style
}

const push = (out: string[], prefix: string, value: Length | undefined) => {
  if (value !== undefined) out.push(value === DEFAULT_STEP ? prefix : lengthClass(prefix, value))
}

/** Renders one style group to utilities, in a stable canonical order. */
function groupClasses(style: Group): string[] {
  const out: string[] = []
  const { position, layout, spacing, size, surface, text } = style

  if (position) {
    if (position.position) out.push(position.position)
    for (const key of ['inset', 'top', 'right', 'bottom', 'left', 'z'] as const) push(out, key, position[key])
  }
  if (layout) {
    if (layout.display) out.push(layout.display)
    if (layout.direction) out.push(`flex-${layout.direction}`)
    if (layout.wrap) out.push(`flex-${layout.wrap}`)
    if (layout.align) out.push(`items-${layout.align}`)
    if (layout.justify) out.push(`justify-${layout.justify}`)
    push(out, 'grid-cols', layout.cols)
    push(out, 'grid-rows', layout.rows)
    if (layout.grow !== undefined) out.push(layout.grow === 0 ? 'grow-0' : 'grow')
    if (layout.shrink !== undefined) out.push(layout.shrink === 0 ? 'shrink-0' : 'shrink')
    push(out, 'basis', layout.basis)
  }
  if (spacing) {
    for (const [prefix, key] of Object.entries(SPACING)) push(out, prefix, spacing[key])
  }
  if (size) {
    for (const [prefix, key] of Object.entries(SIZE)) push(out, prefix, size[key])
  }
  if (surface) {
    push(out, 'rounded', surface.radius)
    push(out, 'border', surface.border)
    for (const [side, key] of Object.entries(BORDER_SIDE)) push(out, `border-${side}`, surface[key])
  }
  if (text) {
    push(out, 'text', text.size)
    if (text.weight) out.push(`font-${text.weight}`)
    push(out, 'tracking', text.tracking)
    push(out, 'leading', text.leading)
    if (text.align) out.push(`text-${text.align}`)
    if (text.wrap) out.push(`text-${text.wrap}`)
    if (text.transform) out.push(text.transform)
    if (text.italic) out.push('italic')
    if (text.truncate) out.push('truncate')
  }
  if (style.raw) out.push(...style.raw)
  return out
}

/** Renders a `Style` to a class list: base utilities first, then each breakpoint in ascending order. */
export function toClasses(style: Style | undefined): string {
  if (!style) return ''
  const out = groupClasses(style)
  for (const breakpoint of breakpoints) {
    const group = style.at?.[breakpoint]
    if (group) out.push(...groupClasses(group).map(token => `${breakpoint}:${token}`))
  }
  return out.join(' ')
}

/** True when a length is a Tailwind arbitrary value (`[42rem]`); Design Mode edits the inner CSS directly. */
export const isArbitrary = (value: Length | undefined) => typeof value === 'string' && value.startsWith('[') && value.endsWith(']')
