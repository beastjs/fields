import { expect, test } from 'bun:test';
import { helloWorld } from '../src/playground/examples';
import { addSection, planPageInstall, readProjectThemeId, STUDIO_STYLESHEET } from '../src/playground/studio/page';
import { builtInThemes, INHERIT_THEME, installedThemeCss, isSafeToken, paintStyles, themeById, themeCss, themeIdFromCss, THEME_BASE } from '../src/playground/studio/themes';
import type { ThemeDocument } from '../src/playground/studio/themes';
import { repaintTheme } from '../src/playground/studio/colorhunt';
import { builtInPresets } from './built-in-presets';

const presets = builtInPresets;
const midnight = builtInThemes.find(theme => theme.themeId === 'midnight')!;
const stylesheetOf = (files: Record<string, string>) => files['/src/style.css'] ?? '';

test('a theme emits the Tailwind variables its utilities already compile against', () => {
  const css = themeCss(midnight);
  // Page colour and font carry through every section via currentColor.
  expect(css).toContain('--studio-bg: oklch(0.18 0.02 265);');
  expect(css).toContain('--studio-fg: oklch(0.93 0.01 265);');
  // Radius, spacing and font are Tailwind's own variables, so every rounded-*, p-* and gap-* follows.
  expect(css).toContain('--radius-3xl: 2rem;');
  expect(css).toContain('--spacing: 0.25rem;');
  expect(css).toContain('--font-sans: ui-sans-serif, system-ui, sans-serif;');
  expect(css).toContain(':root {');
  expect(themeIdFromCss(css)).toBe('midnight');
});

test('the installed theme block can be forwarded to the persistent application preview', () => {
  const css = themeCss(midnight);
  expect(installedThemeCss({ '/src/App.btsx': 'div Hello', '/src/style.css': `@import "tailwindcss";\n${css}\nbody { margin: 0; }` })).toBe(css);
  expect(installedThemeCss({ '/src/style.css': '@import "tailwindcss";\nbody { margin: 0; }' })).toBe('');
});

test('a theme with a dark variant scopes it, and one without emits no dark rule', () => {
  const paper = builtInThemes.find(theme => theme.themeId === 'paper')!;
  expect(themeCss(paper)).toContain(":root[data-theme='dark'] {");
  expect(themeCss(midnight)).not.toContain('data-theme');
});

test('a paint style adds its rules to the block, and the default style adds none', () => {
  const brand: ThemeDocument = {
    themeId: 'branded',
    name: 'Branded',
    description: '',
    paint: 'brand',
    tokens: { color: { brand: '#B8892D', 'accent-1': '#F5EFE3', 'accent-2': '#D8C9A8', 'accent-3': '#4F5B2A' } }
  };
  const css = themeCss(brand);
  // Levels are ordinary colour tokens, so they arrive as Tailwind's own --color-* variables.
  expect(css).toContain('--color-brand: #B8892D;');
  expect(css).toContain('--color-accent-3: #4F5B2A;');
  expect(css).not.toContain('--studio-fg');
  // The rules are layered below the utilities on purpose: a preset that already muted an element keeps its tone.
  expect(css).toContain('@layer base {');
  expect(css).toContain('[data-page] [data-section] :where(a, button) { color: var(--color-brand); }');
  // Only the accented elements take a colour: headings keep the page's own type.
  expect(css).not.toContain(':where(h1');
  expect(css).not.toContain('var(--color-accent-');
  expect(css.indexOf('@layer base {')).toBeLessThan(css.indexOf('/* end Design Studio theme */'));
  // Washed is the style every theme had before paint styles existed, and it writes exactly what it always did.
  expect(themeCss(midnight)).not.toContain('@layer');
  expect(themeCss({ ...midnight, paint: 'washed' })).toBe(themeCss(midnight));
  expect(paintStyles.map(style => style.id)).toEqual(['washed', 'brand']);
});

test('the inherit theme declares nothing, so sections read as they did before themes existed', () => {
  const css = themeCss(INHERIT_THEME);
  expect(css).not.toContain(':root {');
  expect(css).not.toContain('--studio-bg');
  expect(themeById(builtInThemes, 'nope')).toBe(INHERIT_THEME);
  expect(themeById(builtInThemes, 'midnight')).toBe(midnight);
});

test('token values that could escape the declaration are dropped, not escaped', () => {
  const hostile: ThemeDocument = {
    themeId: 'hostile',
    name: 'Hostile',
    description: '',
    tokens: { color: { bg: 'red; } :root { color: blue', fg: 'url(/*x*/)', accent: 'oklch(0.7 0.1 90)' } }
  };
  const css = themeCss(hostile);
  expect(css).toContain('--studio-accent: oklch(0.7 0.1 90);');
  expect(css).not.toContain('color: blue');
  expect(css).not.toContain('url(');
  // Exactly one rule survives, so nothing broke out of the block.
  expect(css.match(/\{/g)?.length).toBe(1);
  expect(isSafeToken('bg', 'red; }')).toBe(false);
  expect(isSafeToken('bg', '@import "x"')).toBe(false);
  expect(isSafeToken('BG', 'red')).toBe(false);
  expect(isSafeToken('bg', 'oklch(0.5 0.1 90)')).toBe(true);
});

test('the studio stylesheet carries the themed defaults so an unthemed page still renders', () => {
  expect(STUDIO_STYLESHEET).toContain(THEME_BASE.trim().split('\n')[0]);
  expect(STUDIO_STYLESHEET).toContain('color: var(--studio-fg);');
  expect(STUDIO_STYLESHEET).toContain('background-color: var(--studio-bg);');
});

test('installing writes the chosen theme last, and switching replaces it instead of stacking', () => {
  const blocks = addSection([], 'hero-centered', presets).blocks;

  const plain = planPageInstall(helloWorld, blocks, presets);
  expect(stylesheetOf(plain.files)).not.toContain('Design Studio theme');

  const themed = planPageInstall(helloWorld, blocks, presets, midnight);
  const css = stylesheetOf(themed.files);
  expect(css).toContain('/* Design Studio theme: Midnight */');
  expect(css).toContain('--radius-3xl: 2rem;');
  // The theme comes after the element defaults, so it wins.
  expect(css.indexOf('Design Studio theme')).toBeGreaterThan(css.indexOf('Design Studio sections'));

  const project = { ...helloWorld, files: { ...helloWorld.files, ...themed.files } };
  expect(readProjectThemeId(project)).toBe('midnight');
  const sunrise = builtInThemes.find(theme => theme.themeId === 'sunrise')!;
  const swapped = stylesheetOf(planPageInstall(project, blocks, presets, sunrise).files);
  expect(swapped).toContain('/* Design Studio theme: Sunrise */');
  expect(swapped).not.toContain('Midnight');
  expect(swapped.match(/Design Studio theme:/g)?.length).toBe(1);

  // Going back to Inherit removes the block rather than leaving stale variables behind.
  const bare = stylesheetOf(planPageInstall(project, blocks, presets, INHERIT_THEME).files);
  expect(bare).not.toContain('--radius-3xl');
  expect(bare).toContain('Design Studio sections');
  expect(readProjectThemeId({ ...project, files: { ...project.files, '/src/style.css': bare } })).toBeUndefined();
});

test('re-installing the same theme is a no-op, so the button reads as up to date', () => {
  const blocks = addSection([], 'hero-centered', presets).blocks;
  const first = planPageInstall(helloWorld, blocks, presets, midnight);
  const project = { ...helloWorld, files: { ...helloWorld.files, ...first.files } };
  expect(planPageInstall(project, blocks, presets, midnight).files).toEqual({});
});

test('applying a theme upgrades section styles installed before page theming existed', () => {
  const blocks = addSection([], 'hero-centered', presets).blocks;
  const install = planPageInstall(helloWorld, blocks, presets, midnight);
  const legacyCss = install.files['/src/style.css'].replace(THEME_BASE, '') + '\n.custom { opacity: 0.8; }\n';
  const project = { ...helloWorld, files: { ...helloWorld.files, ...install.files, '/src/style.css': legacyCss } };

  const upgrade = planPageInstall(project, blocks, presets, midnight);
  expect(Object.keys(upgrade.files)).toEqual(['/src/style.css']);
  const css = stylesheetOf(upgrade.files);
  expect(css).toContain(THEME_BASE.trim());
  expect(css).toContain('.custom { opacity: 0.8; }');
  expect(css.match(/Design Studio sections/g)).toHaveLength(1);
  expect(css.match(/\[data-page\]/g)).toHaveLength(1);
  const upgraded = { ...project, files: { ...project.files, ...upgrade.files } };
  expect(planPageInstall(upgraded, blocks, presets, midnight).files).toEqual({});
});

test('a repainted theme installs and reads back by its own id, rules and all', () => {
  const blocks = addSection([], 'hero-centered', presets).blocks;
  const brand = repaintTheme(midnight, 'brand');

  const install = planPageInstall(helloWorld, blocks, presets, brand);
  const css = stylesheetOf(install.files);
  // The suffixed id is what makes the reading recoverable: the name alone would read back as plain Midnight.
  expect(readProjectThemeId({ ...helloWorld, files: { ...helloWorld.files, ...install.files } })).toBe('midnight~brand');
  expect(css).toContain('--color-brand: oklch(0.72 0.15 265);');
  expect(css).toContain(':where(a, button) { color: var(--color-brand); }');
  // The paint rules sit inside the block, so switching styles replaces them rather than leaving both sets behind.
  const project = { ...helloWorld, files: { ...helloWorld.files, ...install.files } };
  const washed = stylesheetOf(planPageInstall(project, blocks, presets, midnight).files);
  expect(washed).not.toContain('--color-brand');
  expect(washed).not.toContain('var(--color-accent-3)');
  expect(washed).toContain('--studio-fg: oklch(0.93 0.01 265);');
  expect(washed.match(/Design Studio theme:/g)?.length).toBe(1);
  // And re-installing the repainted theme is still a no-op, so the block is byte-identical each time.
  expect(planPageInstall(project, blocks, presets, brand).files).toEqual({});
});
