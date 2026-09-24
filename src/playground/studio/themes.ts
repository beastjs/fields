/**
 * Themes as CSS custom properties.
 *
 * Tailwind v4 compiles its utilities against variables — `p-4` is `calc(var(--spacing) * 4)`, `rounded-lg` is
 * `var(--radius-lg)`, `text-xl` is `var(--text-xl)`. Once those utilities exist in the compiled stylesheet, changing
 * the variables repaints everything without touching a class name, so switching a theme updates one `<style>` node
 * in the preview rather than triggering a rebuild.
 *
 * Sections stay monochrome and derive their colour from `currentColor`, so setting the page's colour and background
 * carries the whole palette through every `current/15` tint without editing a single preset.
 */

export interface ThemeTokens {
  /** `bg`, `fg` and `accent` paint the page; any other key becomes `--color-<key>` for `bg-<key>` utilities. */
  color: Record<string, string>
  /** Keyed by Tailwind's radius scale (`sm`, `lg`, `3xl`, `full`); `base` sets every unnamed radius. */
  radius?: Record<string, string>
  /** `sans`, `serif`, `mono`; `sans` also becomes the page's font. */
  font?: Record<string, string>
  /** `base` sets `--spacing`, the step every padding, margin and gap utility multiplies. */
  spacing?: Record<string, string>
  shadow?: Record<string, string>
}

/**
 * How a theme's colours reach the sections.
 *
 * Presets never name a colour. Every fill, hairline and muted line in them is `currentColor` at some alpha —
 * `bg-current/10`, `border-current/15`, `text-current/70` — so what a section looks like is decided entirely by
 * which colour is current where. A paint style is that decision, and it is the only thing that differs between
 * two themes built from the same four colours.
 *
 * `washed` is the original and still the default: the page takes the palette's ground and type, and since nothing
 * below sets a colour of its own, every tint in every section is that one type colour at low alpha. A page painted
 * this way reads as a single wash, which is what makes the presets look designed rather than assembled.
 *
 * `brand` spends the palette on roles instead of on the page. The most prominent colour becomes `--color-brand`
 * and lands on the affordances; the remaining three become `--color-accent-1` … `--color-accent-3`, quietest to
 * loudest, and take the page's ground wash and the two levels of heading. The rules move `color` rather than
 * painting elements directly, so a button's `bg-current/15` becomes a brand wash and its border follows, with no
 * preset edited. They sit in `@layer base`, below the utilities on purpose: an element that already says
 * `text-current/70` keeps its muted tone, so the brand lands on what the preset left at full strength.
 */
export type PaintStyle = 'washed' | 'brand'

/** The paint styles a theme can be built in, in the order a chooser should offer them. */
export const paintStyles: { id: PaintStyle; label: string; description: string }[] = [
  { id: 'washed', label: 'Washed', description: 'The palette washes the whole page: one ground, one type colour, every section a tint of it.' },
  { id: 'brand', label: 'Brand', description: 'A near-neutral page. The strongest colour carries the buttons and links, the rest become accent levels.' }
]

export const DEFAULT_PAINT: PaintStyle = 'washed'

/** The style a theme is painted in, for a chooser or a note. `undefined` for a theme that never said. */
export const paintOf = (theme: ThemeDocument) => paintStyles.find(style => style.id === theme.paint)

/**
 * A theme's id under one paint style, for a theme that is a reference rather than a recipe.
 *
 * A hunted palette encodes its style in its own id, because the id already carries every colour and rebuilding the
 * theme from it is the whole point. A built-in or a generated theme is not rebuilt from its id — it is looked up,
 * or recomposed from coordinates that say nothing about paint — so a second reading of it needs an id that still
 * names the theme it came from. Hence a suffix: `midnight~brand` reads back as Midnight, painted brand.
 *
 * The default style stays unmarked, so every id written before paint styles existed keeps its exact meaning.
 */
export const paintedThemeId = (baseId: string, paint: PaintStyle) =>
  paint === DEFAULT_PAINT ? baseId : `${baseId}~${paint}`

const PAINTED_ID = /^(.+)~([a-z]+)$/

/**
 * The theme and style a painted id names, or `undefined` for a plain id.
 *
 * An unknown style is not a painted id at all rather than a theme painted in the default style: reading it as
 * washed would silently repaint a theme whose stylesheet was explicit about being something else.
 */
export const readPaintedId = (themeId: string): { baseId: string; paint: PaintStyle } | undefined => {
  const match = PAINTED_ID.exec(themeId)
  if (!match) return undefined
  const paint = paintStyles.find(style => style.id === match[2])
  return paint ? { baseId: match[1], paint: paint.id } : undefined
}

export interface ThemeDocument {
  themeId: string
  name: string
  description: string
  tokens: ThemeTokens
  /** Applied under `[data-theme=dark]`; absent for a theme that reads the same either way. */
  dark?: ThemeTokens
  /** How the tokens reach the sections. Absent means `washed`, which is how every theme was painted before. */
  paint?: PaintStyle
}

/**
 * A token value must be a plain CSS value. Themes can come from a team's own record, so anything that could close
 * the declaration or open a rule is refused rather than escaped.
 */
const SAFE_VALUE = /^[^;{}<>@\\]*$/
const SAFE_KEY = /^[a-z0-9-]{1,32}$/

export const isSafeToken = (key: string, value: string) =>
  SAFE_KEY.test(key) && value.length <= 200 && SAFE_VALUE.test(value) && !value.includes('/*')

/** The custom properties one token set declares. */
function declarations(tokens: ThemeTokens): string[] {
  const out: string[] = []
  const add = (property: string, value: string) => out.push(`  ${property}: ${value};`)

  for (const [key, value] of Object.entries(tokens.color)) {
    if (!isSafeToken(key, value)) continue
    if (key === 'bg' || key === 'fg' || key === 'accent') add(`--studio-${key}`, value)
    else add(`--color-${key}`, value)
  }
  for (const [key, value] of Object.entries(tokens.radius ?? {})) {
    if (!isSafeToken(key, value)) continue
    add(key === 'base' ? '--radius' : `--radius-${key}`, value)
  }
  for (const [key, value] of Object.entries(tokens.font ?? {})) {
    if (!isSafeToken(key, value)) continue
    add(`--font-${key}`, value)
    if (key === 'sans') add('--studio-font', value)
  }
  for (const [key, value] of Object.entries(tokens.spacing ?? {})) {
    if (!isSafeToken(key, value)) continue
    add(key === 'base' ? '--spacing' : `--spacing-${key}`, value)
  }
  for (const [key, value] of Object.entries(tokens.shadow ?? {})) {
    if (!isSafeToken(key, value)) continue
    add(key === 'base' ? '--shadow' : `--shadow-${key}`, value)
  }
  return out
}

export const THEME_START = '/* Design Studio theme'
export const THEME_END = '/* end Design Studio theme */'
/** The theme block a previous install wrote, so choosing another replaces it instead of stacking. */
export const THEME_BLOCK = /\/\* Design Studio theme[\s\S]*?\/\* end Design Studio theme \*\/\n?/
const THEME_ID = /^\/\* Design Studio theme id: (\S+) \*\/$/m

/** The generated theme block installed in a project's stylesheets, ready to overlay in a live preview. */
export function installedThemeCss(files: Readonly<Record<string, string>>): string {
  for (const [path, source] of Object.entries(files)) {
    if (!path.endsWith('.css')) continue
    const block = source.match(THEME_BLOCK)?.[0]
    if (block) return block
  }
  return ''
}

/** The stable id recorded inside generated theme CSS, independent of the selector UI or display name. */
export function themeIdFromCss(css: string): string | undefined {
  const encoded = css.match(THEME_ID)?.[1]
  if (!encoded) return undefined
  try { return decodeURIComponent(encoded) || undefined }
  catch { return undefined }
}

/**
 * The rules a paint style needs on top of its custom properties.
 *
 * Layered rather than unlayered, unlike the declarations above, and that is the whole trick: `@layer base` loses to
 * the utilities, so a preset that already muted an element with `text-current/70` keeps its own tone and only what
 * the preset left at full strength takes the role colour. Every selector is a constant — nothing from a theme
 * document reaches this — so there is nothing here to sanitise.
 */
const paintRules: Record<PaintStyle, string> = {
  washed: '',
  brand: `@layer base {
  [data-page] [data-section] :where(a, button) { color: var(--color-brand); }
  [data-page] [data-section] :where(h1, h2) { color: var(--color-accent-3); }
  [data-page] [data-section] :where(h3, h4) { color: var(--color-accent-2); }
}`
}

/**
 * The stylesheet for a theme.
 *
 * The declarations are deliberately unlayered: the studio's defaults sit in `@layer base`, and unlayered rules beat
 * any layer regardless of specificity, so a theme overrides them without having to match `:root[data-theme='light']`
 * selector for selector. A paint style's rules are the exception and say why in `paintRules`.
 */
export function themeCss(theme: ThemeDocument): string {
  const base = declarations(theme.tokens)
  const dark = theme.dark ? declarations(theme.dark) : []
  // A theme that declares nothing writes nothing, so choosing Inherit leaves the stylesheet as it was.
  if (!base.length && !dark.length) return ''
  const encodedId = encodeURIComponent(theme.themeId).replace(/\*/g, '%2A')
  const blocks = [`${THEME_START}: ${theme.name.replace(/[^\w\s-]/g, '')} */`, `/* Design Studio theme id: ${encodedId} */`]
  if (base.length) blocks.push(`:root {\n${base.join('\n')}\n}`)
  if (dark.length) blocks.push(`:root[data-theme='dark'] {\n${dark.join('\n')}\n}`)
  const rules = paintRules[theme.paint ?? DEFAULT_PAINT]
  if (rules) blocks.push(rules)
  blocks.push(THEME_END)
  return `${blocks.join('\n')}\n`
}

/**
 * The defaults a themed page needs: the page takes its colour, background and font from the tokens, and every
 * section inherits them through `currentColor`. Layered, so any theme overrides it.
 */
export const THEME_BASE = `@layer base {
  :root {
    --studio-bg: transparent;
    --studio-fg: inherit;
    --studio-accent: currentColor;
  }
  [data-page] {
    color: var(--studio-fg);
    background-color: var(--studio-bg);
    font-family: var(--studio-font, inherit);
  }
}
`

/** The theme every page starts on: no tokens at all, so sections read exactly as they did before themes existed. */
export const INHERIT_THEME: ThemeDocument = {
  themeId: 'inherit',
  name: 'Inherit',
  description: 'No palette of its own. Sections stay monochrome and follow whatever surrounds them.',
  tokens: { color: {} }
}

/**
 * The built-in themes. Each one is only variables, so the same 44 presets render as a different product under each.
 */
export const builtInThemes: ThemeDocument[] = [
  INHERIT_THEME,
  {
    themeId: 'midnight',
    name: 'Midnight',
    description: 'Deep blue-black with cool grey type and generous rounding.',
    tokens: {
      color: { bg: 'oklch(0.18 0.02 265)', fg: 'oklch(0.93 0.01 265)', accent: 'oklch(0.72 0.15 265)' },
      radius: { sm: '0.375rem', md: '0.625rem', lg: '0.875rem', xl: '1.125rem', '2xl': '1.5rem', '3xl': '2rem' },
      font: { sans: 'ui-sans-serif, system-ui, sans-serif' },
      spacing: { base: '0.25rem' }
    }
  },
  {
    themeId: 'paper',
    name: 'Paper',
    description: 'Warm off-white with near-black serif headings and soft edges.',
    tokens: {
      color: { bg: 'oklch(0.97 0.01 85)', fg: 'oklch(0.23 0.01 85)', accent: 'oklch(0.55 0.13 45)' },
      radius: { sm: '0.25rem', md: '0.5rem', lg: '0.75rem', xl: '1rem', '2xl': '1.25rem', '3xl': '1.5rem' },
      font: { sans: 'ui-serif, Georgia, serif' },
      spacing: { base: '0.28rem' }
    },
    dark: { color: { bg: 'oklch(0.21 0.01 85)', fg: 'oklch(0.94 0.01 85)', accent: 'oklch(0.72 0.12 45)' } }
  },
  {
    themeId: 'terminal',
    name: 'Terminal',
    description: 'Near-black, monospaced, square corners and tight spacing.',
    tokens: {
      color: { bg: 'oklch(0.16 0.01 150)', fg: 'oklch(0.88 0.06 150)', accent: 'oklch(0.78 0.16 150)' },
      radius: { sm: '0', md: '0', lg: '0.125rem', xl: '0.125rem', '2xl': '0.25rem', '3xl': '0.25rem', full: '0.25rem' },
      font: { sans: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
      spacing: { base: '0.22rem' }
    }
  },
  {
    themeId: 'sunrise',
    name: 'Sunrise',
    description: 'Warm light ground, roomy spacing and very round corners.',
    tokens: {
      color: { bg: 'oklch(0.98 0.02 70)', fg: 'oklch(0.28 0.03 40)', accent: 'oklch(0.68 0.18 45)' },
      radius: { sm: '0.5rem', md: '0.875rem', lg: '1.25rem', xl: '1.75rem', '2xl': '2.25rem', '3xl': '2.75rem' },
      font: { sans: 'ui-rounded, ui-sans-serif, system-ui, sans-serif' },
      spacing: { base: '0.3rem' }
    },
    dark: { color: { bg: 'oklch(0.22 0.03 40)', fg: 'oklch(0.95 0.02 70)', accent: 'oklch(0.75 0.16 45)' } }
  }
]

export const themeById = (themes: readonly ThemeDocument[], themeId: string | undefined) =>
  themes.find(theme => theme.themeId === themeId) ?? INHERIT_THEME
