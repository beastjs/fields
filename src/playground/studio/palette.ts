/**
 * Palettes as a coordinate space, and the arithmetic that keeps them legible.
 *
 * A `ThemeDocument` looks like a design artefact, but every part of it that matters is a number: the ground's
 * lightness, the cast's hue, how much chroma the accent carries, how far the corners are rounded, how tight the
 * spacing step is. Seven coordinates reconstruct a whole theme, which is what makes a theme something a model can
 * be asked to *locate* rather than asked to write.
 *
 * Nothing in this module calls a model. It composes a theme from coordinates, proves the result is readable with
 * real contrast maths rather than a judgment, and turns any theme — generated here, built in, or authored by a
 * team — back into the English a text-only model needs in order to have an opinion about it. Keeping that split
 * clean is the point: colour contrast is arithmetic and belongs in code, while "does this feel expensive" is not
 * and does not.
 */

import type { ThemeDocument, ThemeTokens } from './themes'

/** Where the page's ground sits, dark to light. */
export type Ground = 'void' | 'dark' | 'dim' | 'light' | 'bright'
/** Type voice. Each maps to a font stack, and to a strong prior about what the page is for. */
export type Voice = 'mono' | 'grotesk' | 'geometric' | 'humanist' | 'serif' | 'rounded'
export type Hue =
  | 'neutral' | 'rose' | 'red' | 'amber' | 'yellow' | 'lime'
  | 'green' | 'teal' | 'cyan' | 'blue' | 'indigo' | 'violet' | 'magenta'

/**
 * The coordinates of one theme.
 *
 * The three named axes are categorical because their options really are distinct kinds. The four numeric ones are
 * continuous on purpose: a probability-weighted Score lands between its levels, so "fairly vivid" arrives as 0.62
 * and becomes a chroma, instead of being rounded to whichever adjacent label won.
 */
export interface ThemeAxes {
  ground: Ground
  /** The cast of the page itself. `neutral` keeps the ground grey and lets the accent carry all the colour. */
  hue: Hue
  /** The accent's hue, which is often deliberately unrelated to the ground's. */
  accent: Hue
  /** 0 bleached, 1 vivid. */
  saturation: number
  /** 0 square, 1 pill. */
  corners: number
  voice: Voice
  /** 0 tight, 1 airy. */
  density: number
  /** 0 the quietest type that still passes, 1 as stark as the ground allows. */
  contrast: number
}

const HUE_ANGLE: Record<Hue, number> = {
  neutral: 265, rose: 10, red: 28, amber: 68, yellow: 95, lime: 125,
  green: 148, teal: 182, cyan: 212, blue: 262, indigo: 288, violet: 306, magenta: 330
}

/** The ground's own lightness. `dim` is a real choice — graphite pages — not a midpoint nobody picks. */
const GROUND_L: Record<Ground, number> = { void: 0.15, dark: 0.22, dim: 0.34, light: 0.95, bright: 0.99 }

const FONT: Record<Voice, string> = {
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  grotesk: 'ui-sans-serif, system-ui, sans-serif',
  geometric: 'Avenir, Montserrat, ui-sans-serif, system-ui, sans-serif',
  humanist: 'Seravek, Optima, Candara, ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, serif',
  rounded: 'ui-rounded, "SF Pro Rounded", ui-sans-serif, system-ui, sans-serif'
}

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value))
const lerp = (from: number, to: number, at: number) => from + (to - from) * clamp(at)
const round = (value: number, places = 3) => Number(value.toFixed(places))

export interface Rgb {
  r: number
  g: number
  b: number
}

/**
 * OKLCH to linear sRGB, by the standard OKLab matrices.
 *
 * Linear rather than gamma-encoded because relative luminance — and therefore contrast — is defined on linear
 * light. A component outside 0..1 means the colour is outside the sRGB gamut, which the caller needs to know
 * before it writes the value into a stylesheet, so nothing is clamped here.
 */
export function oklchToLinearRgb(l: number, c: number, h: number): Rgb {
  const radians = (h * Math.PI) / 180
  const a = c * Math.cos(radians)
  const b = c * Math.sin(radians)
  const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const short = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return {
    r: 4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    g: -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    b: -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short
  }
}

/** Whether every component of a linear sRGB triple is displayable, with a hair of tolerance for rounding. */
export const inGamut = ({ r, g, b }: Rgb) => [r, g, b].every(channel => channel >= -0.0001 && channel <= 1.0001)

/**
 * The most chroma this lightness and hue can carry and still render.
 *
 * Generated colours are otherwise quietly clipped by the browser, which desaturates them unevenly and moves the
 * hue. Bisecting for the gamut edge keeps a vivid theme vivid and an impossible one merely as vivid as it can be.
 */
export function fitChroma(l: number, chroma: number, h: number): number {
  if (inGamut(oklchToLinearRgb(l, chroma, h))) return chroma
  let low = 0
  let high = chroma
  for (let step = 0; step < 18; step += 1) {
    const middle = (low + high) / 2
    if (inGamut(oklchToLinearRgb(l, middle, h))) low = middle
    else high = middle
  }
  return low
}

/** WCAG 2.1 relative luminance. Out-of-gamut components are clipped here, as a display would. */
export const luminance = ({ r, g, b }: Rgb) =>
  0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b)

/** WCAG 2.1 contrast ratio between two OKLCH colours, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const first = luminance(oklchToLinearRgb(a.l, a.c, a.h))
  const second = luminance(oklchToLinearRgb(b.l, b.c, b.h))
  const [light, dark] = first >= second ? [first, second] : [second, first]
  return (light + 0.05) / (dark + 0.05)
}

export interface Oklch {
  l: number
  c: number
  h: number
}

const oklch = ({ l, c, h }: Oklch) => `oklch(${round(l)} ${round(c)} ${round(h, 1)})`

/**
 * Body text: WCAG AA, the floor that actually has to hold.
 *
 * AAA would be safer and was the first choice, but it silently eats the bottom of the `contrast` axis — with a 7:1
 * floor, "quiet type that sits close to its ground" composes to 7.6:1, which is not quiet, and the axis only
 * really varies over its top half. AA keeps every generated theme compliant while leaving low contrast available
 * as the deliberate design choice it is. `clearsAAA` reports which themes go further.
 */
export const BODY_CONTRAST = 4.5
/** Large type and accents against the ground. AA for large text. */
export const ACCENT_CONTRAST = 3
/** The stricter grade, reported rather than enforced, so a caller can prefer it without the axis losing its range. */
export const BODY_CONTRAST_AAA = 7

/**
 * Push `mover` away from `against` in lightness until the pair clears `target`.
 *
 * The axis asks for a contrast and this honours it where it can, but a request quieter than legible loses: the
 * ratio is a floor, not a preference. Walking lightness in small steps rather than solving for it keeps the
 * colour's hue and chroma exactly as chosen right up to the point where it has to give.
 */
function separate(mover: Oklch, against: Oklch, target: number, up: boolean): Oklch {
  let candidate = { ...mover }
  for (let step = 0; step < 100; step += 1) {
    if (contrastRatio(candidate, against) >= target) break
    const l = clamp(candidate.l + (up ? 0.01 : -0.01), 0.02, 0.995)
    if (l === candidate.l) break
    candidate = { ...candidate, l, c: fitChroma(l, candidate.c, candidate.h) }
  }
  return candidate
}

const RADIUS_KEYS = ['sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const
/** The proportions of Tailwind's radius scale, in rem at full roundness. */
const RADIUS_SCALE = [0.5, 0.875, 1.25, 1.75, 2.25, 2.75]

/** A theme's full radius scale for a `corners` value. Square at 0, which is a real style rather than a fallback. */
export function radiusScale(corners: number): Record<string, string> {
  const at = clamp(corners)
  const out: Record<string, string> = {}
  RADIUS_KEYS.forEach((key, index) => {
    const rem = RADIUS_SCALE[index] * at
    // Under about a pixel there is nothing to see, so a nearly-square scale becomes an actually-square one
    // rather than a set of sub-pixel radii that only show up in the stylesheet.
    out[key] = rem < 0.07 ? '0' : `${round(rem, 3)}rem`
  })
  // Square themes keep pills from going fully round too, or a lone stadium button fights every other edge.
  out.full = at < 0.15 ? '0.25rem' : '9999px'
  return out
}

export interface ComposedTheme {
  theme: ThemeDocument
  /** The ratios actually achieved, so a caller can show them rather than promise them. */
  contrast: { body: number; accent: number }
  /** True when the requested `contrast` was quieter than legible and had to be raised to meet AA. */
  raised: boolean
  /** The theme also clears the stricter AAA grade for body text. */
  clearsAAA: boolean
}

/**
 * Compose a theme from coordinates. Deterministic: the same axes always give the same stylesheet.
 *
 * The ground carries only a trace of its hue — a cast, not a colour — because a section tinted with
 * `currentColor/15` over a strongly coloured ground turns muddy. The accent is where saturation is allowed to go.
 */
export function composeTheme(axes: ThemeAxes, identity: { themeId: string; name: string; description: string }): ComposedTheme {
  const saturation = clamp(axes.saturation)
  const groundHue = HUE_ANGLE[axes.hue]
  const accentHue = HUE_ANGLE[axes.accent]
  const dark = GROUND_L[axes.ground] < 0.5

  const bgL = GROUND_L[axes.ground]
  const bg: Oklch = {
    l: bgL,
    // Neutral means neutral: a grey page, with the accent carrying every bit of the colour.
    c: axes.hue === 'neutral' ? 0 : fitChroma(bgL, 0.006 + saturation * 0.032, groundHue),
    h: groundHue
  }

  // Spans the whole legible range: quiet at the bottom, near-maximum separation at the top.
  const reach = 0.3 + clamp(axes.contrast) * 0.58
  const wantedL = clamp(dark ? bgL + reach : bgL - reach, 0.05, 0.98)
  const fgWanted: Oklch = {
    l: wantedL,
    c: axes.hue === 'neutral' ? 0 : fitChroma(wantedL, 0.004 + saturation * 0.016, groundHue),
    h: groundHue
  }
  const fg = separate(fgWanted, bg, BODY_CONTRAST, dark)

  // An accent sits against the ground, so its lightness is pinned to the opposite side of it rather than to type.
  const accentL = dark ? lerp(0.66, 0.8, saturation) : lerp(0.58, 0.46, saturation)
  /**
   * A neutral accent means a grey accent — a genuinely monochrome page, which is what `minimal` and `brutalist`
   * are asking for. The hue angle still has to be zeroed here and not only on the ground, or "no colour" composes
   * to whatever angle `neutral` nominally carries and the page acquires an accent nobody chose.
   */
  const accentChroma = axes.accent === 'neutral' ? 0 : fitChroma(accentL, 0.07 + saturation * 0.14, accentHue)
  const accent = separate({ l: accentL, c: accentChroma, h: accentHue }, bg, ACCENT_CONTRAST, dark)

  const tokens: ThemeTokens = {
    color: { bg: oklch(bg), fg: oklch(fg), accent: oklch(accent) },
    radius: radiusScale(axes.corners),
    font: { sans: FONT[axes.voice] },
    spacing: { base: `${round(lerp(0.22, 0.32, axes.density), 3)}rem` }
  }

  /**
   * A light theme also gets a dark variant, the way the built-in Paper and Sunrise do: the same hues re-grounded,
   * so a page that respects the OS setting does not lose its palette in the dark. A dark theme is already dark.
   */
  const inverse = (() => {
    if (dark) return undefined
    const invertedBgL = 0.2
    const invertedBg: Oklch = {
      l: invertedBgL,
      c: axes.hue === 'neutral' ? 0 : fitChroma(invertedBgL, 0.008 + saturation * 0.026, groundHue),
      h: groundHue
    }
    const invertedFgL = clamp(invertedBgL + reach, 0.05, 0.98)
    const invertedFg = separate(
      { l: invertedFgL, c: axes.hue === 'neutral' ? 0 : fitChroma(invertedFgL, 0.004 + saturation * 0.014, groundHue), h: groundHue },
      invertedBg,
      BODY_CONTRAST,
      true
    )
    const invertedAccentL = lerp(0.68, 0.82, saturation)
    const invertedAccent = separate(
      {
        l: invertedAccentL,
        c: axes.accent === 'neutral' ? 0 : fitChroma(invertedAccentL, 0.07 + saturation * 0.13, accentHue),
        h: accentHue
      },
      invertedBg,
      ACCENT_CONTRAST,
      true
    )
    return { color: { bg: oklch(invertedBg), fg: oklch(invertedFg), accent: oklch(invertedAccent) } } satisfies ThemeTokens
  })()

  const body = contrastRatio(fg, bg)
  return {
    theme: { ...identity, tokens, ...(inverse ? { dark: inverse } : {}) },
    contrast: { body: round(body, 2), accent: round(contrastRatio(accent, bg), 2) },
    raised: Math.abs(fg.l - wantedL) > 0.001,
    clearsAAA: body >= BODY_CONTRAST_AAA
  }
}

/* ------------------------------------------------------------------ *
 * Reading a theme back, for a model that can only read words
 * ------------------------------------------------------------------ */

const OKLCH_VALUE = /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)/i
const HEX_VALUE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/** OKLCH and hex are what themes are written in here; anything else is reported verbatim rather than guessed at. */
export function parseColor(value: string): Oklch | undefined {
  const oklchMatch = OKLCH_VALUE.exec(value.trim())
  if (oklchMatch) {
    const number = (raw: string, scale: number) =>
      raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 * scale : Number(raw)
    const l = number(oklchMatch[1], 1)
    const c = number(oklchMatch[2], 0.4)
    const h = Number(oklchMatch[3])
    return [l, c, h].every(Number.isFinite) ? { l, c, h } : undefined
  }
  const hexMatch = HEX_VALUE.exec(value.trim())
  if (!hexMatch) return undefined
  const digits = hexMatch[1].length === 3 ? [...hexMatch[1]].map(digit => digit + digit).join('') : hexMatch[1]
  const channels = [0, 2, 4].map(at => parseInt(digits.slice(at, at + 2), 16) / 255)
  const linear = channels.map(channel => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
  return linearRgbToOklch({ r: linear[0], g: linear[1], b: linear[2] })
}

/** The inverse of `oklchToLinearRgb`, for reading colours a team wrote in some other notation. */
export function linearRgbToOklch({ r, g, b }: Rgb): Oklch {
  const cube = (value: number) => Math.cbrt(value)
  const long = cube(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const medium = cube(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const short = cube(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const l = 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short
  const a = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short
  const bAxis = 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short
  const hue = (Math.atan2(bAxis, a) * 180) / Math.PI
  return { l, c: Math.hypot(a, bAxis), h: hue < 0 ? hue + 360 : hue }
}

const band = <T extends string>(value: number, stops: readonly [number, T][], last: T): T => {
  for (const [ceiling, label] of stops) if (value < ceiling) return label
  return last
}

const lightnessWord = (l: number) =>
  band(l, [[0.14, 'near-black'], [0.26, 'very dark'], [0.42, 'dark'], [0.58, 'mid'], [0.74, 'light'], [0.9, 'very light']], 'near-white')

const chromaWord = (c: number) =>
  band(c, [[0.012, 'effectively grey'], [0.04, 'barely tinted'], [0.08, 'muted'], [0.14, 'saturated']], 'vivid')

/** The nearest hue family, for describing a colour that was not composed from an axis. */
export const hueName = (h: number): Hue => {
  const wrapped = ((h % 360) + 360) % 360
  let best: Hue = 'blue'
  let closest = Infinity
  for (const [name, angle] of Object.entries(HUE_ANGLE) as [Hue, number][]) {
    if (name === 'neutral') continue
    const delta = Math.min(Math.abs(wrapped - angle), 360 - Math.abs(wrapped - angle))
    if (delta < closest) { closest = delta; best = name }
  }
  return best
}

const describeColor = (value: string) => {
  const parsed = parseColor(value)
  if (!parsed) return value
  const chroma = chromaWord(parsed.c)
  return chroma === 'effectively grey'
    ? `${lightnessWord(parsed.l)} neutral grey`
    : `${lightnessWord(parsed.l)} ${chroma} ${hueName(parsed.h)}`
}

/** A rem length, or a bare `0` — which is what a square theme's radius scale is written as. */
const remOf = (value: string | undefined) => {
  const text = value?.trim() ?? ''
  if (text === '0') return 0
  const number = Number(/^([\d.]+)rem$/.exec(text)?.[1])
  return Number.isFinite(number) ? number : undefined
}

/** `lg`'s proportion of the scale, so a length can be read back as the `corners` coordinate that produced it. */
const LG_PROPORTION = RADIUS_SCALE[RADIUS_KEYS.indexOf('lg')]

/**
 * Corners as the coordinate rather than the length.
 *
 * Banding the raw `lg` value cannot describe a scale consistently — Terminal's 2px `lg` is square in character
 * while a theme built on a larger step is not, and both are small numbers. Dividing by the scale's own proportion
 * recovers the 0..1 roundness the length came from, which is the thing being described.
 */
const cornerWord = (theme: ThemeDocument) => {
  const lg = theme.tokens.radius?.lg
  if (lg === undefined) return 'default corner rounding'
  const rem = remOf(lg)
  if (rem === undefined) return `corners of ${lg}`
  return band(
    rem / LG_PROPORTION,
    [[0.12, 'perfectly square corners'], [0.4, 'slightly softened corners'], [0.72, 'clearly rounded corners'], [1.05, 'very rounded corners']],
    'pill-like corners'
  )
}

const voiceWord = (theme: ThemeDocument) => {
  const sans = theme.tokens.font?.sans?.toLowerCase() ?? ''
  if (!sans) return 'the surrounding page font'
  if (sans.includes('mono')) return 'a monospaced typeface'
  if (sans.includes('serif') && !sans.includes('sans-serif')) return 'a serif typeface'
  if (sans.includes('rounded')) return 'a rounded sans typeface'
  if (sans.includes('avenir') || sans.includes('montserrat')) return 'a geometric sans typeface'
  if (sans.includes('seravek') || sans.includes('optima')) return 'a humanist sans typeface'
  return 'a neutral sans typeface'
}

const densityWord = (theme: ThemeDocument) => {
  const rem = remOf(theme.tokens.spacing?.base)
  if (rem === undefined) return 'default spacing'
  return band(rem, [[0.235, 'tight spacing'], [0.265, 'compact spacing'], [0.295, 'comfortable spacing']], 'airy spacing')
}

export interface ThemePortrait {
  name: string
  /** One sentence a text-only model can form an opinion about. */
  summary: string
  /** The measured facts, kept separate so a judgment never has to estimate them. */
  measured: { bodyContrast?: number; accentContrast?: number; ground: 'dark' | 'light' | 'mid' }
  /** Present when the theme also ships a dark variant. */
  dark?: string
}

/**
 * Any theme as words and measurements.
 *
 * This is the whole interface between a palette and a model that cannot see. It works on built-in themes and on a
 * team's own records, not only on generated ones, which is what lets the same questions grade an existing theme
 * and locate a new one. Contrast is measured here and handed over as a number, because a model asked to estimate
 * it would answer plausibly and be wrong.
 */
export function portrait(theme: ThemeDocument): ThemePortrait {
  const { bg, fg, accent } = theme.tokens.color
  const parsedBg = bg ? parseColor(bg) : undefined
  const parsedFg = fg ? parseColor(fg) : undefined
  const parsedAccent = accent ? parseColor(accent) : undefined
  const colours = [
    bg ? `a ${describeColor(bg)} ground` : 'no ground colour of its own',
    fg ? `${describeColor(fg)} type` : 'inherited type colour',
    ...(accent ? [`a ${describeColor(accent)} accent`] : [])
  ]
  return {
    name: theme.name,
    summary: `${colours.join(', ')}, set in ${voiceWord(theme)} with ${cornerWord(theme)} and ${densityWord(theme)}.`,
    measured: {
      ...(parsedBg && parsedFg ? { bodyContrast: round(contrastRatio(parsedFg, parsedBg), 2) } : {}),
      ...(parsedBg && parsedAccent ? { accentContrast: round(contrastRatio(parsedAccent, parsedBg), 2) } : {}),
      ground: parsedBg === undefined ? 'mid' : parsedBg.l < 0.45 ? 'dark' : parsedBg.l > 0.62 ? 'light' : 'mid'
    },
    ...(theme.dark?.color.bg ? { dark: `In dark mode: a ${describeColor(theme.dark.color.bg)} ground with ${theme.dark.color.fg ? describeColor(theme.dark.color.fg) : 'inherited'} type.` } : {})
  }
}
