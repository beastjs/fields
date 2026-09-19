import {
  composeTheme,
  portrait,
  type ComposedTheme,
  type Ground,
  type Hue,
  type ThemeAxes,
  type ThemePortrait,
  type Voice
} from '../playground/studio/palette'
import type { ThemeDocument } from '../playground/studio/themes'
import { band, gates, ranked, type Band, type ChoiceAnswer } from './contracts'

/**
 * The theme vocabulary, and everything about designed themes that needs no model.
 *
 * Split from `theme.ts` for one concrete reason: the Design Studio is in the shell's initial bundle, and the
 * workflows in `theme.ts` reach Effect. Anything the studio needs in order to *render* a theme — the aura list, the
 * axis tables, composing a theme from coordinates, rebuilding one from its id — lives here and costs the bundle
 * nothing. The workflows are loaded on demand when someone actually designs something.
 *
 * It is also the honest boundary. Locating a palette needs a judgment; naming it, composing it and reading it back
 * out of an id do not.
 */

/**
 * The aura archetypes: the character a palette carries before a single word of copy is read.
 *
 * This is the one list worth arguing about, because it is both the rubric Jev judges against and the vocabulary
 * the UI speaks. Each rubric names what the archetype *does*, not what it looks like, so the same list works in
 * both directions — choosing an aura for a brief, and recognising the aura of a palette that already exists.
 */
export const auras = {
  terminal: 'Engineered and utilitarian. Monospaced, square, dense. For people who read logs',
  brutalist: 'Raw and unapologetic. Stark contrast, no softening, structure left showing',
  editorial: 'Considered and typographic, like a printed magazine. Generous, serif, quiet colour',
  clinical: 'Precise and calm. Cool, clean, evenly spaced. Reassuring in a medical or scientific way',
  corporate: 'Safe and institutional. Conventional blues and greys that signal permanence over personality',
  luxe: 'Restrained and expensive. Dark, sparing, confident in what it leaves out',
  playful: 'Bright and informal. Round, saturated, obviously friendly',
  retro: 'Nostalgic and analogue. Warm, slightly faded, of an earlier decade',
  cyber: 'Synthetic and high-energy. Neon accents on near-black, deliberately artificial',
  organic: 'Earthy and soft. Natural tones, nothing sharp, nothing loud',
  minimal: 'Reduced to almost nothing. Near-monochrome, airy, one accent at most',
  zine: 'Scrappy and DIY. Harsh contrast, cheap-looking on purpose, anti-polish',
  dreamy: 'Soft and hazy. Pastel, low contrast, unhurried',
  industrial: 'Heavy and mechanical. Greys, metal, weight, tight structure'
} as const
export type Aura = keyof typeof auras

export const GROUND_CRITERIA: Record<Ground, string> = {
  void: 'Near-black. The page recedes and light elements float on it',
  dark: 'Clearly dark, but not black. A dark product UI',
  dim: 'Mid-tone graphite or slate. Neither a light nor a dark page',
  light: 'Off-white. Soft, paper-like, not clinically bright',
  bright: 'Almost pure white. Maximum openness'
}

export const HUE_CRITERIA: Record<Hue, string> = {
  neutral: 'No colour in the page itself. A grey ground, with any colour carried by the accent alone',
  rose: 'Pink-leaning red. Soft, contemporary, a little fashionable',
  red: 'True red. Urgent, appetising or bold',
  amber: 'Orange. Warm, energetic, inviting',
  yellow: 'Yellow. Bright, optimistic, hard to use quietly',
  lime: 'Yellow-green. Fresh, synthetic, energetic',
  green: 'True green. Growth, money, nature, safety',
  teal: 'Blue-green. Calm and competent without being corporate',
  cyan: 'Bright blue-green. Technical, cold, electric',
  blue: 'True blue. Trust, software, institutions',
  indigo: 'Deep blue-violet. Considered, premium, slightly nocturnal',
  violet: 'Purple. Creative, synthetic, modern software',
  magenta: 'Pink-purple. Loud, expressive, unmistakably a choice'
}

export const VOICE_CRITERIA: Record<Voice, string> = {
  mono: 'Monospaced. Code, machines, engineers. Every character the same width',
  grotesk: 'Neutral system sans. The default voice of software. Gets out of the way',
  geometric: 'Geometric sans built from circles and straight lines. Modern, designed, a little cold',
  humanist: 'Humanist sans with calligraphic warmth. Approachable without being childish',
  serif: 'Serif. Authority, editorial, long-form reading, age',
  rounded: 'Rounded sans with soft terminals. Friendly, consumer, informal'
}

export const ERA_CRITERIA = {
  machine: 'The terminal era. Monospaced, square, green or amber on black',
  print: 'Mid-century print. Serif, paper grounds, restrained ink',
  early_web: 'The early web. Loud, high contrast, unsubtle colour',
  y2k: 'Y2K and chrome. Cold blues, gradients, synthetic gloss',
  flat: 'The flat 2010s. Bright primaries, no depth, rounded rectangles',
  now: 'Contemporary. Dark grounds, one saturated accent, generous rounding'
} as const
export type Era = keyof typeof ERA_CRITERIA

/** Where an axis lands when Jev could not separate its options: the least opinionated option available. */
export const NEUTRAL_AXES = { ground: 'light', hue: 'neutral', accent: 'blue', voice: 'grotesk' } as const

/** One categorical axis, with the runners-up kept so the UI can offer them. */
export interface AxisChoice<Option extends string> {
  value: Option
  confidence: number
  band: Band
  /** Best first, the winner included. A near-tie is the interesting case, so nothing is dropped. */
  ranked: [Option, number][]
  /** The model could not separate the options, so `value` is the neutral default rather than its pick. */
  unsure: boolean
}

export const axisChoice = <Option extends string>(answer: ChoiceAnswer<Option>, fallback: Option): AxisChoice<Option> => {
  const strength = band(answer.confidence, gates.suggestion)
  // A theme is previewed before it is installed, so a weak read is worth showing — but not worth pretending about.
  const unsure = strength === 'defer'
  return {
    value: unsure ? fallback : answer.choice,
    confidence: answer.confidence,
    band: strength,
    ranked: ranked(answer.probabilities),
    unsure
  }
}

/**
 * The continuous axes, snapped to the 100 steps an id can carry.
 *
 * Without this the id is lossy: 0.65 encodes to 64 and decodes to 0.6464, so a theme rebuilt from its own id would
 * differ in the third decimal, the stylesheet would differ by a hair, and reopening the studio would report an
 * installed theme as unsaved changes. Quantising at design time costs nothing a display can resolve and makes the
 * round trip exact.
 */
const STEPS = 99
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
export const quantize = (value: number) => Math.round(clamp01(value) * STEPS) / STEPS
const TWO = (value: number) => String(Math.round(clamp01(value) * STEPS)).padStart(2, '0')

/**
 * A stable id for a generated theme: the coordinates themselves, aura included.
 *
 * Deterministic on purpose, and reversible — see `themeFromId`. The same brief answered the same way produces the
 * same id, so re-running a design does not orphan the theme already installed in a project's stylesheet, and
 * `themeIdFromCss` reads it straight back out of the generated CSS.
 */
export const themeIdOf = (axes: ThemeAxes, aura: Aura) =>
  `gen-${aura}-${axes.ground}-${axes.hue}-${axes.accent}-${axes.voice}-` +
  `${TWO(axes.saturation)}${TWO(axes.corners)}${TWO(axes.density)}${TWO(axes.contrast)}`

const AURA_LABEL: Record<Aura, string> = {
  terminal: 'Terminal', brutalist: 'Brutal', editorial: 'Editorial', clinical: 'Clinic', corporate: 'Standard',
  luxe: 'Luxe', playful: 'Playful', retro: 'Retro', cyber: 'Cyber', organic: 'Organic', minimal: 'Minimal',
  zine: 'Zine', dreamy: 'Dream', industrial: 'Foundry'
}
const HUE_LABEL: Record<Hue, string> = {
  neutral: 'Grey', rose: 'Rose', red: 'Red', amber: 'Amber', yellow: 'Citron', lime: 'Lime', green: 'Green',
  teal: 'Teal', cyan: 'Cyan', blue: 'Blue', indigo: 'Indigo', violet: 'Violet', magenta: 'Magenta'
}

/** Named from its own coordinates, because the model that chose them cannot write a name. */
export const themeName = (aura: Aura, axes: ThemeAxes) =>
  `${AURA_LABEL[aura]} ${HUE_LABEL[axes.hue === 'neutral' ? axes.accent : axes.hue]}`

/** Compose the palette, then let the portrait write the description — it already says exactly this. */
export const buildTheme = (axes: ThemeAxes, aura: Aura): ComposedTheme => {
  const first = composeTheme(axes, { themeId: themeIdOf(axes, aura), name: themeName(aura, axes), description: '' })
  return { ...first, theme: { ...first.theme, description: portrait(first.theme).summary } }
}

const isKeyOf = <T extends object>(table: T, value: string): value is Extract<keyof T, string> =>
  Object.prototype.hasOwnProperty.call(table, value)

/**
 * A generated theme rebuilt from its id alone.
 *
 * This is what a reversible id buys: a generated theme needs no storage at all. A project whose stylesheet carries
 * `gen-terminal-void-neutral-cyan-mono-64050184` can have that theme recomposed on open — same name, same tokens,
 * same description, no Convex row and no model call. Anything that is not a generated id returns undefined, so a
 * caller can fall through to the themes it does hold.
 */
export const themeFromId = (themeId: string): ThemeDocument | undefined => {
  const parts = themeId.split('-')
  if (parts.length !== 7 || parts[0] !== 'gen') return undefined
  const [, aura, ground, hue, accent, voice, digits] = parts
  if (!isKeyOf(auras, aura) || !isKeyOf(GROUND_CRITERIA, ground) || !isKeyOf(HUE_CRITERIA, hue)) return undefined
  if (!isKeyOf(HUE_CRITERIA, accent) || !isKeyOf(VOICE_CRITERIA, voice) || !/^\d{8}$/.test(digits)) return undefined
  const at = (index: number) => Number(digits.slice(index, index + 2)) / STEPS
  return buildTheme(
    { ground, hue, accent, voice, saturation: at(0), corners: at(2), density: at(4), contrast: at(6) },
    aura
  ).theme
}

export interface ThemeDesign {
  axes: ThemeAxes
  theme: ThemeDocument
  /** Measured, not judged: the ratios the composed palette actually achieves. */
  contrast: ComposedTheme['contrast']
  /** The requested contrast was too quiet to be legible and was raised to meet AA. */
  contrastRaised: boolean
  aura: AxisChoice<Aura>
  ground: AxisChoice<Ground>
  hue: AxisChoice<Hue>
  accentHue: AxisChoice<Hue>
  voice: AxisChoice<Voice>
  /** The continuous axes, as Jev's probability-weighted scores. */
  scales: { saturation: number; corners: number; density: number; contrast: number }
}

/**
 * The same theme with one axis overridden by hand.
 *
 * Every coordinate a model chose is one a developer can take back without re-running anything, because composition
 * is pure. This is what keeps the feature from being a slot machine — and why it lives here rather than beside the
 * workflows: dragging a slider must never reach the network.
 */
export const withAxes = (design: ThemeDesign, overrides: Partial<ThemeAxes>): ThemeDesign => {
  const merged = { ...design.axes, ...overrides }
  // A hand-set slider is quantised on the same grid as a model-chosen one, so every theme's id stays reversible.
  const axes: ThemeAxes = {
    ...merged,
    saturation: quantize(merged.saturation),
    corners: quantize(merged.corners),
    density: quantize(merged.density),
    contrast: quantize(merged.contrast)
  }
  const composed = buildTheme(axes, design.aura.value)
  return {
    ...design,
    axes,
    theme: composed.theme,
    contrast: composed.contrast,
    contrastRaised: composed.raised,
    scales: { saturation: axes.saturation, corners: axes.corners, density: axes.density, contrast: axes.contrast }
  }
}

export interface ThemeMood {
  aura: AxisChoice<Aura>
  era: AxisChoice<Era>
  /** Each 0..1, probability-weighted across its levels. */
  temperature: number
  energy: number
  formality: number
  weight: number
  premium: number
  trustworthy: number
  /** What the model was shown. Worth surfacing, because a judgment can only be as good as this. */
  portrait: ThemePortrait
}

/** At most this many questions in one call, and this long each, to stay well inside Jev's context budget. */
export const MAX_QUERIES = 12
export const MAX_QUERY_LENGTH = 400

export interface ThemeAnswer {
  question: string
  /** 0 no, 1 yes. The number is the answer; a noul has no separate confidence. */
  probability: number
  /** `unsure` is a real outcome: the margin around an even chance is not a yes. */
  verdict: 'yes' | 'no' | 'unsure'
}

/**
 * The questions worth offering before anyone types their own.
 *
 * Deliberately the ones a developer cannot answer by looking: whether a palette survives contexts they are not
 * in. Each is a plain Noul, so they cost one call together and can be mixed with the developer's own.
 */
export const standardQueries = [
  'This palette would suit a product sold to large enterprises',
  'This palette would suit a product used by children',
  'This palette reads as more expensive than its competitors',
  'This palette would still work if the product added a dense data table',
  'This palette is distinctive enough not to be mistaken for a template',
  'Someone reading this page in bright sunlight would struggle'
] as const
