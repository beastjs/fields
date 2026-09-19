import { expect, test } from 'bun:test';
import {
  ACCENT_CONTRAST, BODY_CONTRAST, composeTheme, contrastRatio, fitChroma, hueName, inGamut, linearRgbToOklch,
  luminance, oklchToLinearRgb, parseColor, portrait, radiusScale, type Ground, type Hue, type ThemeAxes, type Voice
} from '../src/playground/studio/palette';
import { builtInThemes, isSafeToken, themeCss } from '../src/playground/studio/themes';

const identity = { themeId: 'test', name: 'Test', description: '' };
const axes = (over: Partial<ThemeAxes> = {}): ThemeAxes => ({
  ground: 'light', hue: 'neutral', accent: 'blue', saturation: 0.5, corners: 0.5, voice: 'grotesk', density: 0.5, contrast: 0.5, ...over,
});

// The published WCAG endpoints. If these drift, every contrast guarantee below is meaningless.
test('contrast maths lands on the known WCAG values', () => {
  expect(luminance(oklchToLinearRgb(0, 0, 0))).toBeCloseTo(0, 4);
  expect(luminance(oklchToLinearRgb(1, 0, 0))).toBeCloseTo(1, 4);
  expect(contrastRatio({ l: 0, c: 0, h: 0 }, { l: 1, c: 0, h: 0 })).toBeCloseTo(21, 2);
  // #777777 against white is a published 4.48:1, which pins the whole OKLCH -> sRGB path.
  expect(contrastRatio(parseColor('#777777')!, { l: 1, c: 0, h: 0 })).toBeCloseTo(4.48, 2);
});

test('colour parsing round-trips and refuses what it cannot read', () => {
  expect(parseColor('#000')!.l).toBeCloseTo(0, 3);
  expect(parseColor('#ffffff')!.l).toBeCloseTo(1, 3);
  expect(parseColor('oklch(0.62 0.2 262)')).toEqual({ l: 0.62, c: 0.2, h: 262 });
  // Percentages are legal OKLCH and mean the same colour.
  expect(parseColor('oklch(62% 0.2 262)')).toEqual({ l: 0.62, c: 0.2, h: 262 });
  // A value it cannot read is reported as unreadable rather than guessed at, so no judgment is built on a default.
  expect(parseColor('var(--brand)')).toBeUndefined();
  expect(parseColor('rebeccapurple')).toBeUndefined();
  const there = linearRgbToOklch(oklchToLinearRgb(0.62, 0.14, 262));
  expect(there.l).toBeCloseTo(0.62, 3);
  expect(there.c).toBeCloseTo(0.14, 3);
  expect(there.h).toBeCloseTo(262, 1);
});

test('chroma is fitted to the sRGB gamut instead of being clipped by the browser', () => {
  // Nothing at this lightness can carry 0.4 chroma; unclamped it would render as an unevenly desaturated, hue-shifted mess.
  expect(fitChroma(0.5, 0.4, 262)).toBeLessThan(0.24);
  expect(inGamut(oklchToLinearRgb(0.5, fitChroma(0.5, 0.4, 262), 262))).toBe(true);
  // A chroma that already fits is returned untouched, so a restrained palette is not quietly altered.
  expect(fitChroma(0.5, 0.05, 262)).toBe(0.05);
});

/**
 * The load-bearing test. A generated theme is applied to a whole page at once and nobody proof-reads it, so every
 * reachable point in the axis space has to be legible by construction rather than by review.
 */
test('every point in the axis space is WCAG AA legible and renderable', () => {
  const grounds: Ground[] = ['void', 'dark', 'dim', 'light', 'bright'];
  const hues: Hue[] = ['neutral', 'rose', 'red', 'amber', 'yellow', 'lime', 'green', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'magenta'];
  const voices: Voice[] = ['mono', 'grotesk', 'geometric', 'humanist', 'serif', 'rounded'];
  let checked = 0;
  let worstBody = Infinity;
  let worstAccent = Infinity;
  for (const ground of grounds) for (const hue of hues) for (const accent of hues) for (const saturation of [0, 0.5, 1]) for (const contrast of [0, 0.5, 1]) {
    const composed = composeTheme(axes({ ground, hue, accent, saturation, contrast, voice: voices[checked % voices.length] }), identity);
    checked += 1;
    worstBody = Math.min(worstBody, composed.contrast.body);
    worstAccent = Math.min(worstAccent, composed.contrast.accent);
    // Every declared colour must also be a value the theme serialiser will accept rather than drop.
    for (const [key, value] of Object.entries(composed.theme.tokens.color)) expect(isSafeToken(key, value)).toBe(true);
  }
  expect(checked).toBe(5 * 13 * 13 * 3 * 3);
  expect(worstBody).toBeGreaterThanOrEqual(BODY_CONTRAST);
  expect(worstAccent).toBeGreaterThanOrEqual(ACCENT_CONTRAST);
});

test('the contrast axis spends its whole range, and the floor is what stops it', () => {
  const quiet = composeTheme(axes({ ground: 'void', contrast: 0 }), identity);
  const stark = composeTheme(axes({ ground: 'void', contrast: 1 }), identity);
  // Quiet is genuinely quiet — just past AA — rather than the axis being flattened by too strict a floor.
  expect(quiet.contrast.body).toBeLessThan(5);
  expect(quiet.contrast.body).toBeGreaterThanOrEqual(BODY_CONTRAST);
  expect(stark.contrast.body).toBeGreaterThan(15);
  // The bottom of the axis asks for less than is legible, so the floor moves it and says so.
  expect(quiet.raised).toBe(true);
  expect(quiet.clearsAAA).toBe(false);
  expect(stark.raised).toBe(false);
  expect(stark.clearsAAA).toBe(true);
});

test('composition is deterministic, so the same coordinates are always the same stylesheet', () => {
  const both = [1, 2].map(() => composeTheme(axes({ ground: 'void', accent: 'cyan', saturation: 0.8, corners: 0 }), identity));
  expect(JSON.stringify(both[0])).toBe(JSON.stringify(both[1]));
  expect(themeCss(both[0].theme)).toBe(themeCss(both[1].theme));
});

test('a neutral page keeps every trace of colour out of the ground and in the accent', () => {
  const neutral = composeTheme(axes({ hue: 'neutral', accent: 'violet', saturation: 1 }), identity);
  expect(parseColor(neutral.theme.tokens.color.bg)!.c).toBe(0);
  expect(parseColor(neutral.theme.tokens.color.fg)!.c).toBe(0);
  expect(parseColor(neutral.theme.tokens.color.accent)!.c).toBeGreaterThan(0.1);
  // A tinted page carries only a cast, never a colour: sections tint with currentColor and would turn muddy.
  expect(parseColor(composeTheme(axes({ hue: 'amber', saturation: 1 }), identity).theme.tokens.color.bg)!.c).toBeLessThan(0.05);
});

/**
 * A neutral accent is a real design — monochrome — and has to compose as one. `neutral` carries a nominal hue
 * angle so the ground can be tinted from the same table, and that angle must not leak into the accent.
 */
test('a neutral accent is grey, at full saturation and in the dark variant too', () => {
  const mono = composeTheme(axes({ ground: 'void', hue: 'neutral', accent: 'neutral', saturation: 1 }), identity);
  expect(parseColor(mono.theme.tokens.color.accent)!.c).toBe(0);
  // Grey on grey still has to be visible, which is lightness doing the work.
  expect(mono.contrast.accent).toBeGreaterThanOrEqual(ACCENT_CONTRAST);
  expect(portrait(mono.theme).summary).toContain('neutral grey accent');

  const light = composeTheme(axes({ ground: 'bright', hue: 'neutral', accent: 'neutral', saturation: 1 }), identity);
  expect(parseColor(light.theme.dark!.color.accent)!.c).toBe(0);
});

test('a light theme ships a dark variant and a dark theme does not need one', () => {
  const light = composeTheme(axes({ ground: 'bright' }), identity);
  expect(light.theme.dark).toBeDefined();
  expect(parseColor(light.theme.dark!.color.bg)!.l).toBeLessThan(0.45);
  // The dark variant has to be legible on its own terms, not merely present.
  expect(contrastRatio(parseColor(light.theme.dark!.color.fg)!, parseColor(light.theme.dark!.color.bg)!)).toBeGreaterThanOrEqual(BODY_CONTRAST);
  expect(composeTheme(axes({ ground: 'void' }), identity).theme.dark).toBeUndefined();
});

test('the radius scale is square at nothing and a pill at everything', () => {
  const square = radiusScale(0);
  expect([square.sm, square.md, square.lg, square.xl]).toEqual(['0', '0', '0', '0']);
  // Square themes keep pills small too, or one stadium button fights every other edge on the page.
  expect(square.full).toBe('0.25rem');
  expect(radiusScale(1)).toMatchObject({ sm: '0.5rem', lg: '1.25rem', '3xl': '2.75rem', full: '9999px' });
  expect(radiusScale(0.5).lg).toBe('0.625rem');
});

test('hue naming picks the nearest family and wraps around the wheel', () => {
  expect(hueName(262)).toBe('blue');
  expect(hueName(148)).toBe('green');
  expect(hueName(8)).toBe('rose');
  // 358 is nearer rose (10) than magenta (330) only if the wrap is handled.
  expect(hueName(358)).toBe('rose');
  expect(hueName(-2)).toBe('rose');
});

/** The portrait is the entire interface between a palette and a model that cannot see, so it has to be right. */
test('a portrait describes any theme in words and measures what must not be guessed', () => {
  const terminal = portrait(builtInThemes.find(theme => theme.themeId === 'terminal')!);
  expect(terminal.summary).toContain('monospaced');
  expect(terminal.summary).toContain('square corners');
  expect(terminal.summary).toContain('tight spacing');
  expect(terminal.measured.ground).toBe('dark');
  expect(terminal.measured.bodyContrast).toBeCloseTo(13.8, 1);

  const paper = portrait(builtInThemes.find(theme => theme.themeId === 'paper')!);
  expect(paper.summary).toContain('serif');
  expect(paper.measured.ground).toBe('light');
  // Paper ships a dark variant, and a judgment about the theme should know that.
  expect(paper.dark).toContain('dark mode');

  // Inherit declares nothing, which has to read as "nothing" rather than as a black page.
  const inherit = portrait(builtInThemes.find(theme => theme.themeId === 'inherit')!);
  expect(inherit.measured.bodyContrast).toBeUndefined();
  expect(inherit.summary).toContain('no ground colour of its own');
});

test('a generated theme describes itself, so its stored description matches its tokens', () => {
  const composed = composeTheme(axes({ ground: 'void', hue: 'neutral', accent: 'cyan', voice: 'mono', corners: 0, density: 0 }), identity);
  const described = { ...composed.theme, description: portrait(composed.theme).summary };
  expect(described.description).toContain('cyan accent');
  expect(described.description).toContain('monospaced');
  expect(described.description).toContain('perfectly square corners');
});
