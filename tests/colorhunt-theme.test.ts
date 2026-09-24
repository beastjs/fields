import { expect, test } from 'bun:test';
import { toHex } from '../src/lib/api/colorhunt';
import { paintOfTheme, paletteOfTheme, repaintTheme, themeFromHuntedId, themeFromPalette, themeSwatches } from '../src/playground/studio/colorhunt';
import { builtInThemes, INHERIT_THEME, paintedThemeId, readPaintedId } from '../src/playground/studio/themes';
import { themeFromId } from '../src/jev/theme-model';

/** A real feed entry: a cream, an olive, an ochre and a sand, in Color Hunt's own order. */
const palette = { code: 'f5efe34f5b2ab8892dd8c9a8', colors: toHex('f5efe34f5b2ab8892dd8c9a8'), likes: 39, date: '16 hours' };

test('a packed feed code splits into four upper-case hex colors', () => {
  expect(palette.colors).toEqual(['#F5EFE3', '#4F5B2A', '#B8892D', '#D8C9A8']);
});

test('the palette extremes become ground and type, and swap for dark', () => {
  const theme = themeFromPalette(palette);
  expect(theme.tokens.color.bg).toBe('#F5EFE3');
  expect(theme.tokens.color.fg).toBe('#4F5B2A');
  expect(theme.dark?.color.bg).toBe('#4F5B2A');
  expect(theme.dark?.color.fg).toBe('#F5EFE3');
});

test('each mode takes its accent from the middle pair, the readable one for that ground', () => {
  const theme = themeFromPalette(palette);
  // The darker middle reads on a light ground, the lighter middle on a dark one.
  expect(theme.tokens.color.accent).toBe('#B8892D');
  expect(theme.dark?.color.accent).toBe('#D8C9A8');
  // Between them, all four colors are used and none is repeated within a mode.
  expect(new Set([theme.tokens.color.bg, theme.tokens.color.fg, theme.tokens.color.accent, theme.dark!.color.accent])).toEqual(new Set(palette.colors));
});

test('a palette theme changes only colour, never radius, font or spacing', () => {
  const theme = themeFromPalette(palette);
  expect(theme.tokens.radius).toBeUndefined();
  expect(theme.tokens.font).toBeUndefined();
  expect(theme.tokens.spacing).toBeUndefined();
});

test('the theme is named for its accent hue and credits the feed', () => {
  const theme = themeFromPalette(palette);
  expect(theme.name).toBe('Orange');
  expect(theme.description).toBe('Color Hunt palette · 39 likes · 16 hours');
});

test('a hunted theme rebuilds from its id alone, tokens intact', () => {
  const theme = themeFromPalette(palette);
  const rebuilt = themeFromHuntedId(theme.themeId);
  expect(rebuilt?.themeId).toBe(theme.themeId);
  expect(rebuilt?.tokens).toEqual(theme.tokens);
  expect(rebuilt?.dark).toEqual(theme.dark);
  // Likes and age were never in the id, so only the description differs.
  expect(rebuilt?.description).toBe('Color Hunt palette');
});

test('only a well-formed colorhunt id yields a palette', () => {
  expect(paletteOfTheme(themeFromPalette(palette).themeId)).toEqual(palette.colors);
  expect(paletteOfTheme('midnight')).toBeUndefined();
  expect(paletteOfTheme('colorhunt-nothex')).toBeUndefined();
  expect(themeFromHuntedId('colorhunt-f5efe34f5b2ab8892dd8c9')).toBeUndefined();
});

test('the picker shows a hunted palette in the feed order, not the sorted one', () => {
  expect(themeSwatches(themeFromPalette(palette))).toEqual(palette.colors);
});

test('a built-in shows the colours it declares, and Inherit shows none', () => {
  const midnight = builtInThemes.find(theme => theme.themeId === 'midnight')!;
  expect(themeSwatches(midnight)).toEqual([midnight.tokens.color.bg, midnight.tokens.color.accent, midnight.tokens.color.fg]);
  expect(themeSwatches(builtInThemes.find(theme => theme.themeId === 'inherit')!)).toEqual([]);
});

/* ------------------------------------------------------------------
 * The brand reading of the same four colors
 * ------------------------------------------------------------------ */

test('brand paint spends the most chromatic color on the brand, and the rest as levels', () => {
  const theme = themeFromPalette(palette, 'brand');
  // The ochre, not either extreme: a palette's lightest and darkest are its paper and its ink.
  expect(theme.tokens.color.brand).toBe('#B8892D');
  // Level 1 sits nearest the ground and level 3 furthest from it, so a light page reads light to dark.
  expect(theme.tokens.color['accent-1']).toBe('#F5EFE3');
  expect(theme.tokens.color['accent-2']).toBe('#D8C9A8');
  expect(theme.tokens.color['accent-3']).toBe('#4F5B2A');
  expect(theme.paint).toBe('brand');
});

test('a brand page keeps the ground it is dropped into, under a wash of its quietest level', () => {
  const theme = themeFromPalette(palette, 'brand');
  // Translucent, so the project's own ground still shows through; no type color at all, so the page stays neutral.
  expect(theme.tokens.color.bg).toBe('color-mix(in oklab, #F5EFE3 22%, transparent)');
  expect(theme.tokens.color.fg).toBeUndefined();
  expect(theme.dark?.color.bg).toBe('color-mix(in oklab, #4F5B2A 22%, transparent)');
  expect(theme.dark?.color.fg).toBeUndefined();
});

test('the levels reverse for dark, so level 1 is still the one nearest the ground', () => {
  const theme = themeFromPalette(palette, 'brand');
  expect(theme.dark?.color['accent-1']).toBe('#4F5B2A');
  expect(theme.dark?.color['accent-2']).toBe('#D8C9A8');
  expect(theme.dark?.color['accent-3']).toBe('#F5EFE3');
  // The brand is the one color that does not move: a brand is a brand in either mode.
  expect(theme.dark?.color.brand).toBe('#B8892D');
});

test('the paint style rides in the id, and washed ids stay exactly as they were', () => {
  const washed = themeFromPalette(palette);
  const brand = themeFromPalette(palette, 'brand');
  expect(washed.themeId).toBe('colorhunt-' + palette.code);
  expect(brand.themeId).toBe('colorhunt-brand-' + palette.code);
  expect(paintOfTheme(washed.themeId)).toBe('washed');
  expect(paintOfTheme(brand.themeId)).toBe('brand');
  expect(paintOfTheme('midnight')).toBeUndefined();
  // A style nobody knows is not a hunted id: reading it as washed would repaint a theme the CSS was explicit about.
  expect(paintOfTheme('colorhunt-fresco-' + palette.code)).toBeUndefined();
  expect(paletteOfTheme(brand.themeId)).toEqual(palette.colors);
});

test('a brand theme rebuilds from its id in the style it was installed in', () => {
  const brand = themeFromPalette(palette, 'brand');
  const rebuilt = themeFromHuntedId(brand.themeId);
  expect(rebuilt?.paint).toBe('brand');
  expect(rebuilt?.tokens).toEqual(brand.tokens);
  expect(rebuilt?.dark).toEqual(brand.dark);
  // The washed id keeps rebuilding a washed theme, so a project themed before paint styles existed is untouched.
  expect(themeFromHuntedId('colorhunt-' + palette.code)?.paint).toBeUndefined();
});

test('repainting is a second theme rather than an edit, so both readings can be installed', () => {
  const washed = themeFromPalette(palette);
  const brand = repaintTheme(washed, 'brand');
  expect(brand.themeId).toBe(themeFromPalette(palette, 'brand').themeId);
  expect(brand.tokens).toEqual(themeFromPalette(palette, 'brand').tokens);
  expect(repaintTheme(brand, 'washed').themeId).toBe(washed.themeId);
  // Inherit declares no colours at all, so there is nothing to re-read and it comes back untouched.
  expect(repaintTheme(INHERIT_THEME, 'brand')).toBe(INHERIT_THEME);
});

/* ------------------------------------------------------------------
 * The brand reading of a theme that is not a palette
 * ------------------------------------------------------------------ */

const midnight = builtInThemes.find(theme => theme.themeId === 'midnight')!;

test('a built-in repaints to a suffixed id, because its own id is a lookup rather than a recipe', () => {
  const brand = repaintTheme(midnight, 'brand');
  expect(brand.themeId).toBe('midnight~brand');
  expect(brand.paint).toBe('brand');
  expect(readPaintedId('midnight~brand')).toEqual({ baseId: 'midnight', paint: 'brand' });
  // A plain id is not a painted one, and neither is a suffix naming a style nobody knows.
  expect(readPaintedId('midnight')).toBeUndefined();
  expect(readPaintedId('midnight~fresco')).toBeUndefined();
  // The default style is what every id meant before paint styles existed, so it stays unmarked.
  expect(paintedThemeId('midnight', 'washed')).toBe('midnight');
});

test('the accent becomes the brand, and ground and type become the outer levels by lightness', () => {
  const { color } = repaintTheme(midnight, 'brand').tokens;
  expect(color.brand).toBe(midnight.tokens.color.accent);
  // Midnight is a dark theme, so its near-white type is the level nearest a light ground and its ground is furthest.
  expect(color['accent-1']).toBe(midnight.tokens.color.fg);
  expect(color['accent-3']).toBe(midnight.tokens.color.bg);
  expect(color['accent-2']).toBe(`color-mix(in oklab, ${midnight.tokens.color.fg} 50%, ${midnight.tokens.color.bg})`);
  expect(color.bg).toBe(`color-mix(in oklab, ${midnight.tokens.color.fg} 22%, transparent)`);
  // No type colour, so the page keeps whatever it was dropped into — the same bargain a hunted brand theme makes.
  expect(color.fg).toBeUndefined();
});

test('a repainted theme keeps everything that is not colour, so the design survives the re-reading', () => {
  const brand = repaintTheme(midnight, 'brand');
  expect(brand.tokens.radius).toEqual(midnight.tokens.radius);
  expect(brand.tokens.font).toEqual(midnight.tokens.font);
  expect(brand.tokens.spacing).toEqual(midnight.tokens.spacing);
  expect(brand.name).toBe(midnight.name);
});

test('a generated theme repaints too, since it also composes a ground, a type and an accent', () => {
  const generated = themeFromId('gen-terminal-void-neutral-cyan-mono-64050184')!;
  const brand = repaintTheme(generated, 'brand');
  expect(brand.themeId).toBe(generated.themeId + '~brand');
  expect(brand.tokens.color.brand).toBe(generated.tokens.color.accent);
});

test('repainting starts from the unpainted theme, so a painted one cannot be read a second time', () => {
  const brand = repaintTheme(midnight, 'brand');
  // Nothing is left in it to re-read: going back to Washed is selecting the base again, which the studio does by id.
  expect(repaintTheme(brand, 'washed')).toBe(brand);
  expect(repaintTheme(brand, 'brand')).toBe(brand);
  expect(repaintTheme(midnight, 'washed')).toBe(midnight);
});

test('a brand palette is named for its brand, and shows the same four swatches as its washed twin', () => {
  const brand = themeFromPalette(palette, 'brand');
  expect(brand.name).toBe('Orange');
  expect(themeSwatches(brand)).toEqual(palette.colors);
});
