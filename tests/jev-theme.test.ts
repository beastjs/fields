import { expect, test } from 'bun:test';
import { Effect, Layer } from 'effect';
import { Jev, type Ask, type JevClient } from '../src/jev/client';
import type { Answer, ChoiceAnswer, NoulAnswer, Questions, ScoreAnswer } from '../src/jev/contracts';
import { askAboutTheme, designTheme, readMood } from '../src/jev/theme';
import { MAX_QUERIES, MAX_QUERY_LENGTH, themeFromId, themeIdOf, themeName, withAxes } from '../src/jev/theme-model';
import { BODY_CONTRAST, parseColor, type ThemeAxes } from '../src/playground/studio/palette';
import { builtInThemes, themeCss } from '../src/playground/studio/themes';

const pick = (choice: string, probabilities: Record<string, number>, confidence: number): ChoiceAnswer => ({ type: 'choice', choice, probabilities, confidence });
/** A Score's legend is what `normalized` divides by, so the level count is part of the answer. */
const rate = (score: number, levels = 3, confidence = 0.8): ScoreAnswer => ({ type: 'score', score, legend: Object.fromEntries(Array.from({ length: levels }, (_, level) => [String(level), `level ${level}`])), probabilities: {}, confidence });
const is = (noul: number): NoulAnswer => ({ type: 'noul', noul });

const calls: { questions: Questions; state: unknown }[] = [];
const stub = (answers: (questions: Questions) => Record<string, Answer>) => {
  calls.length = 0;
  return Layer.succeed(Jev, {
    ask: ((request: Ask<Questions>) => {
      calls.push({ questions: request.questions, state: request.state });
      return Effect.succeed({ model: 'jev-1.13.0', answers: answers(request.questions), usage: { input_tokens: 0, output_tokens: 0 } });
    }) as JevClient['ask'],
  });
};
const run = <A>(effect: Effect.Effect<A, unknown, Jev>, provided: Layer.Layer<Jev>) => Effect.runPromise(Effect.provide(effect, provided) as Effect.Effect<A>);

/** A confident read of "a dark, monospaced, engineered tool with an electric accent". */
const confident = () => ({
  ground: pick('void', { void: 0.72, dark: 0.2, dim: 0.04, light: 0.02, bright: 0.02 }, 0.71),
  hue: pick('neutral', { neutral: 0.66, blue: 0.2, teal: 0.14 }, 0.64),
  accent: pick('cyan', { cyan: 0.58, blue: 0.3, teal: 0.12 }, 0.55),
  voice: pick('mono', { mono: 0.81, grotesk: 0.13, geometric: 0.06 }, 0.79),
  aura: pick('terminal', { terminal: 0.76, brutalist: 0.14, cyber: 0.1 }, 0.74),
  saturation: rate(1.3),
  corners: rate(0.1),
  density: rate(0.2),
  contrast: rate(1.7),
});

test('one call answers every axis, and the Scores arrive continuous rather than bucketed', async () => {
  const design = await run(designTheme({ brief: 'a log viewer for platform engineers' }), stub(confident));

  // Nine questions, one request: the whole point of asking a System One model instead of chaining calls.
  expect(calls).toHaveLength(1);
  expect(Object.keys(calls[0].questions).sort()).toEqual(['accent', 'aura', 'contrast', 'corners', 'density', 'ground', 'hue', 'saturation', 'voice']);

  expect(design.axes.ground).toBe('void');
  expect(design.axes.voice).toBe('mono');
  expect(design.axes.accent).toBe('cyan');
  // 1.3 across three levels is 0.65, not "level 1". A continuous parameter keeps a continuous answer.
  expect(design.axes.saturation).toBeCloseTo(0.65, 2);
  expect(design.axes.corners).toBeCloseTo(0.05, 2);
  expect(design.axes.contrast).toBeCloseTo(0.85, 2);
  expect(design.scales).toEqual({ saturation: design.axes.saturation, corners: design.axes.corners, density: design.axes.density, contrast: design.axes.contrast });
  // Quantised onto the grid the id encodes, so the theme and its id always describe the same palette.
  expect(design.axes.saturation * 99).toBeCloseTo(Math.round(design.axes.saturation * 99), 9);
});

test('the composed theme is legible, named from its own coordinates, and describes itself', async () => {
  const design = await run(designTheme({ brief: 'a log viewer' }), stub(confident));
  expect(design.contrast.body).toBeGreaterThanOrEqual(BODY_CONTRAST);
  expect(design.theme.name).toBe('Terminal Cyan');
  expect(design.theme.description).toContain('monospaced');
  expect(design.theme.themeId).toBe(themeIdOf(design.axes, design.aura.value));
  // Square corners and a neutral ground were asked for, so they have to actually be in the tokens.
  expect(design.theme.tokens.radius?.md).toBe('0');
  expect(parseColor(design.theme.tokens.color.bg)!.c).toBe(0);
  expect(parseColor(design.theme.tokens.color.accent)!.c).toBeGreaterThan(0.1);
});

test('an axis the model cannot separate falls back instead of committing to a coin flip', async () => {
  const design = await run(designTheme({ brief: 'a website' }), stub(() => ({
    ...confident(),
    // Four options within noise of each other, and a confidence that says so.
    hue: pick('magenta', { magenta: 0.27, teal: 0.26, amber: 0.24, green: 0.23 }, 0.08),
  })));

  expect(design.hue.unsure).toBe(true);
  expect(design.hue.band).toBe('defer');
  // The page does not get a magenta cast off a 0.27 read; it gets no cast, and the UI is told why.
  expect(design.axes.hue).toBe('neutral');
  // The distribution survives regardless, so the UI can still offer what was nearly chosen.
  expect(design.hue.ranked[0]).toEqual(['magenta', 0.27]);
  expect(design.hue.ranked).toHaveLength(4);
  // A confident axis in the same answer is unaffected.
  expect(design.voice.unsure).toBe(false);
  expect(design.axes.voice).toBe('mono');
});

test('refinements travel as ordered history, so later ones can win and any of them can be undone', async () => {
  await run(designTheme({
    brief: 'a log viewer',
    refinements: ['warmer', 'less corporate'],
    current: { name: 'Terminal Cyan', summary: 'a near-black ground', measured: { ground: 'dark' } },
  }), stub(confident));
  const state = calls[0].state as Record<string, unknown>;
  expect(state.adjustments_requested_in_order).toEqual(['warmer', 'less corporate']);
  expect(state.brief).toBe('a log viewer');
  expect(state.current_theme).toMatchObject({ name: 'Terminal Cyan' });
});

test('a coordinate can be taken back by hand without asking anything again', async () => {
  const design = await run(designTheme({ brief: 'a log viewer' }), stub(confident));
  const before = calls.length;
  const warmer = withAxes(design, { accent: 'amber', corners: 1 });

  expect(calls).toHaveLength(before);
  expect(warmer.axes.accent).toBe('amber');
  expect(warmer.theme.tokens.radius?.lg).toBe('1.25rem');
  expect(warmer.theme.themeId).not.toBe(design.theme.themeId);
  expect(warmer.contrast.body).toBeGreaterThanOrEqual(BODY_CONTRAST);
  // Everything not overridden is untouched, so a refinement is a move rather than a re-roll.
  expect(warmer.axes.ground).toBe(design.axes.ground);
  expect(warmer.axes.saturation).toBe(design.axes.saturation);
});

test('a theme id is its coordinates, so regenerating the same design does not orphan the installed theme', () => {
  const axes: ThemeAxes = { ground: 'void', hue: 'neutral', accent: 'cyan', saturation: 0.65, corners: 0.05, voice: 'mono', density: 0.1, contrast: 0.85 };
  expect(themeIdOf(axes, 'terminal')).toBe(themeIdOf({ ...axes }, 'terminal'));
  expect(themeIdOf(axes, 'terminal')).not.toBe(themeIdOf({ ...axes, accent: 'amber' }, 'terminal'));
  expect(themeIdOf(axes, 'terminal')).not.toBe(themeIdOf(axes, 'luxe'));
  expect(themeIdOf(axes, 'terminal')).toMatch(/^gen-terminal-void-neutral-cyan-mono-\d{8}$/);
  // A neutral page is named for its accent, since that is the only colour anyone will see.
  expect(themeName('terminal', axes)).toBe('Terminal Cyan');
  expect(themeName('luxe', { ...axes, hue: 'indigo' })).toBe('Luxe Indigo');
});

/**
 * The property that lets a generated theme need no storage at all: a project's stylesheet carries the id, and the
 * id carries the whole palette. Without an exact round trip, reopening the studio would report an installed theme
 * as unsaved changes.
 */
test('a generated theme rebuilds from its id alone, byte for byte', async () => {
  const design = await run(designTheme({ brief: 'a log viewer' }), stub(confident));
  const rebuilt = themeFromId(design.theme.themeId);
  expect(rebuilt).toEqual(design.theme);
  expect(themeCss(rebuilt!)).toBe(themeCss(design.theme));

  // A hand-tweaked theme round-trips too, since a slider is quantised on the same grid.
  const tweaked = withAxes(design, { accent: 'amber', saturation: 0.333, corners: 0.777 });
  expect(themeFromId(tweaked.theme.themeId)).toEqual(tweaked.theme);

  // Anything that is not a generated id is declined, so the studio falls through to the themes it holds.
  for (const other of ['midnight', 'inherit', 'gen-nope-void-neutral-cyan-mono-64050184', 'gen-terminal-void-neutral-cyan-mono-640501', 'gen-terminal-void-neutral-cyan-mono-6405018x', 'gen-terminal-void-neutral-cyan-notaface-64050184']) {
    expect(themeFromId(other)).toBeUndefined();
  }
});

test('mood is judged from the portrait, with contrast handed over measured rather than estimated', async () => {
  const terminal = builtInThemes.find(theme => theme.themeId === 'terminal')!;
  const mood = await run(readMood(terminal), stub(() => ({
    aura: pick('terminal', { terminal: 0.8, cyber: 0.2 }, 0.78),
    era: pick('machine', { machine: 0.85, now: 0.15 }, 0.83),
    temperature: rate(0.4), energy: rate(1.5), formality: rate(1.2), weight: rate(1.6),
    premium: is(0.61), trustworthy: is(0.44),
  })));

  const state = calls[0].state as { palette: { summary: string; measured: { bodyContrast: number } } };
  // The model is never asked to estimate a ratio it cannot compute; it is given the number.
  expect(state.palette.measured.bodyContrast).toBeCloseTo(13.8, 1);
  expect(state.palette.summary).toContain('monospaced');
  expect(mood.aura.value).toBe('terminal');
  expect(mood.era.value).toBe('machine');
  expect(mood.temperature).toBeCloseTo(0.2, 3);
  expect(mood.energy).toBeCloseTo(0.75, 3);
  // A noul is the probability itself; it is not rounded into a boolean on the way out.
  expect(mood.premium).toBe(0.61);
  expect(mood.trustworthy).toBe(0.44);
  expect(mood.portrait.name).toBe('Terminal');
});

test("a developer's own question becomes the question, verbatim, and comes back calibrated", async () => {
  const theme = builtInThemes.find(theme => theme.themeId === 'paper')!;
  const asked = ['Would this suit a childrens hospital?', 'Does this look expensive?', 'Is this too safe?'];
  const answers = await run(askAboutTheme(theme, asked), stub(() => ({ q0: is(0.12), q1: is(0.88), q2: is(0.54) })));

  expect(calls).toHaveLength(1);
  // No translation step: a noul's instructions are already a yes/no question in English.
  expect(Object.values(calls[0].questions).map(question => question.instructions)).toEqual(asked);
  expect(Object.values(calls[0].questions).every(question => question.type === 'noul')).toBe(true);
  expect(answers[0]).toMatchObject({ question: asked[0], probability: 0.12, verdict: 'no' });
  expect(answers[1]).toMatchObject({ probability: 0.88, verdict: 'yes' });
  // 0.54 is the model declining to commit. Reporting that is more useful than rounding it to a yes.
  expect(answers[2]).toMatchObject({ probability: 0.54, verdict: 'unsure' });
});

test('free-text questions are bounded, and asking nothing costs nothing', async () => {
  const theme = builtInThemes[1];
  const many = Array.from({ length: MAX_QUERIES + 6 }, (_, index) => `question ${index}?`);
  const capped = await run(askAboutTheme(theme, many), stub(questions => Object.fromEntries(Object.keys(questions).map(id => [id, is(0.5)]))));
  expect(capped).toHaveLength(MAX_QUERIES);

  const long = await run(askAboutTheme(theme, ['x'.repeat(MAX_QUERY_LENGTH + 500)]), stub(() => ({ q0: is(0.5) })));
  expect((long[0].question satisfies string).length).toBe(MAX_QUERY_LENGTH);

  const nothing = await run(askAboutTheme(theme, ['  ', '']), stub(() => ({})));
  expect(nothing).toEqual([]);
  expect(calls).toHaveLength(0);
});
