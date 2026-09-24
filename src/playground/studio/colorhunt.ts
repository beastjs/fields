/**
 * Color Hunt palettes as Design Studio themes.
 *
 * A palette is four colors and nothing else, so a theme built from one is
 * entirely a question of which color takes which job — and there is more than
 * one good answer, so the same four colors build a different theme under each
 * paint style:
 *
 * - `washed` reads the palette as a page. The two extremes become ground and
 *   type and the two in the middle become the accent — the darker one on a
 *   light ground, the lighter one on a dark ground, so the accent stays
 *   readable either way. Sections are monochrome, so the type color washes
 *   through every one of them.
 * - `brand` reads the palette as a system. The most prominent color — the one
 *   with the most chroma, which is the one you would put on a button — becomes
 *   `--color-brand`, and the other three become `--color-accent-1` …
 *   `--color-accent-3`, ordered from the level nearest the ground to the one
 *   furthest from it. The page itself is left alone: its background and type
 *   stay whatever the project gives them, in both modes, and only the accented
 *   elements take the brand.
 *
 * Nothing else is invented. A palette says nothing about radius, font or
 * spacing, so a hunted theme leaves all three alone and changes only color.
 *
 * The id carries the paint style and the original 24-character code, which is
 * what lets a hunted theme survive a reload without a row of its own — the same
 * trick the generated themes use with `themeFromId`. An id with no style in it
 * is washed, so every theme installed before paint styles existed still reads
 * back as the theme it was.
 */

import { type Palette, toHex } from '@/lib/api/colorhunt'
import { brandReading, parseColor } from './palette'
import { DEFAULT_PAINT, type PaintStyle, paintedThemeId, paintStyles, readPaintedId, type ThemeDocument } from './themes'

const PREFIX = 'colorhunt-'
/** `colorhunt-<code>` for the original washed themes, `colorhunt-<paint>-<code>` for every other style. */
const HUNTED_ID = /^colorhunt-(?:([a-z]+)-)?([0-9a-f]{24})$/i

const channels = (hex: string) => [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))

/** sRGB relative luminance (WCAG), used only to find the palette's extremes. */
const luminance = (hex: string) => {
  const [red, green, blue] = channels(hex).map((value) => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** Hue in degrees, or `-1` for a grey with no hue to speak of. */
const hueOf = (hex: string) => {
  const [red, green, blue] = channels(hex).map((value) => value / 255)
  const high = Math.max(red, green, blue)
  const chroma = high - Math.min(red, green, blue)
  if (chroma < 0.04) return -1
  const sixth =
    high === red
      ? ((green - blue) / chroma + 6) % 6
      : high === green
        ? (blue - red) / chroma + 2
        : (red - green) / chroma + 4
  return sixth * 60
}

const hueNames = ['Red', 'Orange', 'Yellow', 'Lime', 'Green', 'Emerald', 'Teal', 'Sky', 'Blue', 'Violet', 'Magenta', 'Rose']

/** A readable name for a palette, so the list reads `Teal` rather than a hex code. */
const nameOf = (hex: string) => {
  const hue = hueOf(hex)
  return hue < 0 ? 'Neutral' : hueNames[Math.round(hue / 30) % 12]
}

/** The code and paint style a hunted theme's id carries, or `undefined` for an id from anywhere else. */
const readHuntedId = (themeId: string): { code: string; paint: PaintStyle } | undefined => {
  const match = HUNTED_ID.exec(themeId)
  if (!match) return undefined
  const [, style, code] = match
  // An unknown style is not a hunted id at all: recovering it as washed would
  // silently repaint a theme the stylesheet was explicit about.
  if (style === undefined) return { code, paint: DEFAULT_PAINT }
  const paint = paintStyles.find(candidate => candidate.id === style.toLowerCase())
  return paint ? { code, paint: paint.id } : undefined
}

/** The id a palette gets under one paint style. The default style stays unmarked, so old ids keep their meaning. */
const huntedId = (code: string, paint: PaintStyle) => PREFIX + (paint === DEFAULT_PAINT ? '' : paint + '-') + code

/** The four colors a hunted theme was built from, recovered from its id. */
export const paletteOfTheme = (themeId: string): string[] | undefined => {
  const hunted = readHuntedId(themeId)
  return hunted ? toHex(hunted.code) : undefined
}

/** The paint style a hunted theme was built in, or `undefined` for a theme that is not a hunted palette. */
export const paintOfTheme = (themeId: string): PaintStyle | undefined => readHuntedId(themeId)?.paint

/**
 * The colors to show for a theme in the picker.
 *
 * A hunted theme shows the palette in Color Hunt's own order, which is how its
 * author arranged it. Everything else shows the tokens it actually declares —
 * three for the built-ins, none for Inherit.
 */
export const themeSwatches = (theme: ThemeDocument): string[] => {
  const hunted = paletteOfTheme(theme.themeId)
  if (hunted) return hunted
  // A brand reading declares no ground or type, only its levels and the brand, so those are what it shows.
  if (theme.paint === 'brand') {
    const { brand, 'accent-1': quiet, 'accent-2': middle, 'accent-3': loud } = theme.tokens.color
    return [quiet, middle, loud, brand].filter((value): value is string => Boolean(value))
  }
  const { accent, bg, fg } = theme.tokens.color
  return [bg, accent, fg].filter((value): value is string => Boolean(value))
}

export const isHuntedTheme = (themeId: string) => paletteOfTheme(themeId) !== undefined

/** OKLCH chroma, which is how colorful a color is once lightness is accounted for. Unparseable reads as grey. */
const chromaOf = (hex: string) => parseColor(hex)?.c ?? 0

/** The palette's colors, lightest first. */
const byLightness = (colors: string[]) => [...colors].sort((a, b) => luminance(b) - luminance(a))

/**
 * The palette as a brand and three accent levels.
 *
 * The brand is the most chromatic color, which is reliably the one a designer
 * would spend on a button — the extremes of a palette are almost always its
 * near-white and its near-black, and neither is a brand. The rest are levels,
 * not roles: level 1 sits nearest the ground and does the quietest work, level 3
 * is furthest from it and carries the headline. Which end is "nearest" flips
 * with the mode, so the levels reverse for dark exactly as the ground does.
 */
const brandTokens = (colors: string[]) => {
  const brand = [...colors].sort((a, b) => chromaOf(b) - chromaOf(a))[0]
  const ranked = byLightness(colors)
  // By index rather than by value: a palette is free to repeat a color, and
  // dropping both copies would leave a level undefined.
  ranked.splice(ranked.indexOf(brand), 1)
  const [light, mid, dark] = ranked
  return {
    brand,
    light: { brand, 'accent-1': light, 'accent-2': mid, 'accent-3': dark },
    dark: { brand, 'accent-1': dark, 'accent-2': mid, 'accent-3': light }
  }
}

const buildTheme = (code: string, colors: string[], description: string, paint: PaintStyle): ThemeDocument => {
  if (paint === 'brand') {
    const tokens = brandTokens(colors)
    return {
      themeId: huntedId(code, paint),
      name: nameOf(tokens.brand),
      description,
      paint,
      tokens: { color: tokens.light },
      dark: { color: tokens.dark }
    }
  }

  const [lightest, lightMid, darkMid, darkest] = byLightness(colors)

  return {
    themeId: huntedId(code, paint),
    name: nameOf(darkMid),
    description,
    tokens: { color: { bg: lightest, fg: darkest, accent: darkMid } },
    dark: { color: { bg: darkest, fg: lightest, accent: lightMid } }
  }
}

/**
 * A palette as it arrives from anywhere.
 *
 * `fetchPalettes` types the colors as a four-tuple, but a Convex validator
 * cannot express a fixed length, so the same palette comes back from the action
 * as a plain array. Both satisfy this.
 */
export type PaletteLike = Omit<Palette, 'colors'> & { colors: string[] }

/** Turns one Color Hunt palette into a theme the studio can apply, painted in the style the studio is set to. */
export const themeFromPalette = (palette: PaletteLike, paint: PaintStyle = DEFAULT_PAINT) =>
  buildTheme(palette.code, palette.colors, `Color Hunt palette · ${palette.likes.toLocaleString()} likes · ${palette.date}`, paint)

/**
 * Rebuilds a hunted theme from its id alone.
 *
 * A theme installed in an earlier session comes back as nothing but the id in
 * the stylesheet. The colors and the paint style are all in there, so the theme
 * is recoverable — only the likes and the age, which were never part of the id,
 * are lost.
 */
export const themeFromHuntedId = (themeId: string): ThemeDocument | undefined => {
  const hunted = readHuntedId(themeId)
  return hunted ? buildTheme(hunted.code, toHex(hunted.code), 'Color Hunt palette', hunted.paint) : undefined
}

/**
 * The same theme in another paint style.
 *
 * Repainting is a rebuild rather than a patch, so it lands on the id the theme
 * would have had if it had been built in that style to begin with — which is
 * what lets both readings sit in the list at once, each recoverable from its own
 * id. A hunted palette rebuilds from its own id; anything else keeps its id and
 * takes a suffix, because a built-in is looked up and a generated theme is
 * recomposed from coordinates that say nothing about paint.
 *
 * A theme that declares no ground, type and accent — Inherit, or a team's record
 * written in a notation the palette maths cannot read — has nothing to re-read
 * and comes back unchanged, so a caller can offer the styles unconditionally and
 * let the ones that cannot move simply not move.
 */
export const repaintTheme = (theme: ThemeDocument, paint: PaintStyle): ThemeDocument => {
  const hunted = readHuntedId(theme.themeId)
  if (hunted) return buildTheme(hunted.code, toHex(hunted.code), theme.description, paint)

  // Anything else is repainted from its unpainted self, so `theme` must be the one the list holds: a painted
  // document has already spent its ground and type on levels and there is nothing left in it to read a second
  // time. Going back to the default style is therefore the base theme itself, which is what a caller that
  // resolved `readPaintedId` before asking already has in hand.
  if (paint === DEFAULT_PAINT || readPaintedId(theme.themeId)) return theme
  const reading = brandReading(theme.tokens)
  if (!reading) return theme
  return {
    ...theme,
    themeId: paintedThemeId(theme.themeId, paint),
    paint,
    tokens: { ...theme.tokens, color: reading.light },
    dark: { ...(theme.dark ?? {}), color: reading.dark }
  }
}
